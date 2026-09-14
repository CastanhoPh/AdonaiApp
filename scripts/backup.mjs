#!/usr/bin/env node
/**
 * Cópia completa do AdonaiApp: banco e arquivos.
 *
 * Não existe backup automático aqui — o Firestore está sem recuperação por
 * ponto no tempo e o Storage sem versionamento. Na prática, o que for apagado
 * ou sobrescrito não tem de onde voltar. Já aconteceu: uma foto de perfil foi
 * sobrescrita por engano e não houve como recuperá-la.
 *
 * O que está em risco não é o app — ele se reconstrói do código. É a memória
 * do grupo: as peças antigas, quem fez qual papel, o histórico de cada um.
 * Alguém sentou e digitou aquilo.
 *
 *   node scripts/backup.mjs                 grava a cópia
 *   node scripts/backup.mjs --destino D:\\x  em outro lugar
 *
 * Por padrão vai para `AdonaiApp-backups`, ao lado da pasta do projeto — fora
 * do repositório de propósito: a cópia tem telefone, data de nascimento e
 * contato de responsável, e isso não entra em git nem por acidente.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getStorage } from "firebase-admin/storage";
import { db } from "./firebase-admin-app.mjs";
import { lerEnv } from "./verificar/ambiente.mjs";

const env = lerEnv();
const bucket = getStorage().bucket(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

const argumentos = process.argv.slice(2);
function opcao(nome, reserva) {
  const i = argumentos.indexOf(`--${nome}`);
  return i !== -1 && argumentos[i + 1] ? argumentos[i + 1] : reserva;
}

const PADRAO = resolve(process.cwd(), "..", "AdonaiApp-backups");
const raiz = resolve(opcao("destino", PADRAO));

/** Carimbo legível e ordenável: `2026-09-14-1830`. */
function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const pasta = join(raiz, carimbo());
mkdirSync(pasta, { recursive: true });

console.log(`\n  Copiando para ${pasta}\n`);

/* ------------------------------------------------------------------ banco */

/**
 * Lê uma coleção inteira, e o que estiver embaixo de cada documento.
 *
 * Subcoleção não vem junto com o documento: `privado/contato` e as presenças
 * de cada ensaio são coleções próprias, e uma cópia que as ignorasse perderia
 * justamente telefone, responsável e quem confirmou presença.
 *
 * Documento que não existe mas tem subcoleção também entra — o Firestore
 * permite isso, e ignorá-lo perderia o que está embaixo dele.
 */
async function copiarColecao(referencia) {
  const documentos = {};
  for (const ref of await referencia.listDocuments()) {
    const instantaneo = await ref.get();
    const dentro = {};
    for (const sub of await ref.listCollections()) {
      dentro[sub.id] = await copiarColecao(sub);
    }
    documentos[ref.id] = {
      dados: instantaneo.exists ? instantaneo.data() : null,
      ...(Object.keys(dentro).length ? { subcolecoes: dentro } : {}),
    };
  }
  return documentos;
}

const banco = {};
let totalDocumentos = 0;
function contar(no) {
  for (const doc of Object.values(no)) {
    if (doc.dados) totalDocumentos++;
    for (const sub of Object.values(doc.subcolecoes ?? {})) contar(sub);
  }
}

for (const colecao of await db.listCollections()) {
  banco[colecao.id] = await copiarColecao(colecao);
  const antes = totalDocumentos;
  contar(banco[colecao.id]);
  console.log(`  ${colecao.id.padEnd(18)} ${totalDocumentos - antes} documento(s)`);
}

/*
 * Datas viram texto ISO em vez do formato interno do Firestore.
 *
 * O `Timestamp` do Admin SDK serializa como `{_seconds, _nanoseconds}`, que
 * não diz nada para quem abrir o arquivo e não volta como data na restauração.
 * O texto ISO é legível e a restauração sabe reconhecê-lo.
 */
function paraJson(_chave, valor) {
  if (valor && typeof valor.toDate === "function") {
    return { __data: valor.toDate().toISOString() };
  }
  return valor;
}

const arquivoDoBanco = join(pasta, "banco.json");
writeFileSync(arquivoDoBanco, JSON.stringify(banco, paraJson, 2), "utf8");
console.log(`\n  banco.json  ${Math.round(statSync(arquivoDoBanco).size / 1024)} kB · ${totalDocumentos} documentos\n`);

/* --------------------------------------------------------------- arquivos */

const [arquivos] = await bucket.getFiles();
const catalogo = [];
let bytes = 0;

for (const arquivo of arquivos) {
  const destino = join(pasta, "arquivos", arquivo.name);
  mkdirSync(dirname(destino), { recursive: true });
  const [conteudo] = await arquivo.download();
  writeFileSync(destino, conteudo);
  bytes += conteudo.length;

  const [meta] = await arquivo.getMetadata();
  catalogo.push({
    caminho: arquivo.name,
    tipo: meta.contentType,
    cacheControl: meta.cacheControl,
    /*
     * O token de download faz parte do endereço que está gravado no Firestore.
     * Sem ele, um arquivo restaurado ganharia endereço novo e toda ficha
     * apontaria para o nada — a restauração devolve o mesmo token.
     */
    token: meta.metadata?.firebaseStorageDownloadTokens ?? null,
    bytes: conteudo.length,
    sha256: createHash("sha256").update(conteudo).digest("hex").slice(0, 16),
  });
  console.log(`  ${String(Math.round(conteudo.length / 1024)).padStart(5)} kB  ${arquivo.name}`);
}

writeFileSync(join(pasta, "arquivos.json"), JSON.stringify(catalogo, null, 2), "utf8");

/* ----------------------------------------------------------------- resumo */

const resumo = [
  `AdonaiApp — cópia de ${new Date().toLocaleString("pt-BR")}`,
  `projeto: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`,
  "",
  `${totalDocumentos} documentos em ${Object.keys(banco).length} coleções`,
  `${catalogo.length} arquivos · ${Math.round(bytes / 1024)} kB`,
  "",
  "Coleções:",
  ...Object.entries(banco).map(([nome, docs]) => `  ${nome}: ${Object.keys(docs).length} no primeiro nível`),
  "",
  "Para devolver ao ar:  node scripts/restaurar.mjs <esta pasta>",
  "",
  "Contém dado pessoal — telefone, data de nascimento e contato de",
  "responsável de menor. Não versione, não compartilhe.",
].join("\n");
writeFileSync(join(pasta, "LEIA.txt"), resumo, "utf8");

console.log(`\n  ${catalogo.length} arquivo(s) · ${Math.round(bytes / 1024)} kB`);

/* Quantas cópias já existem, para o espaço não crescer sem ninguém ver. */
if (existsSync(raiz)) {
  const copias = readdirSync(raiz).filter((n) => /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(n)).sort();
  console.log(`  ${copias.length} cópia(s) em ${raiz}`);
  if (copias.length > 12) {
    console.log(`  a mais antiga é de ${copias[0]} — apague à mão as que não quiser mais`);
  }
}
console.log("");
process.exit(0);
