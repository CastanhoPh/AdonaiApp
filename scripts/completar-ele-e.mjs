#!/usr/bin/env node
/**
 * Completa o elenco de "Ele É".
 *
 * A peça entrou com 4 personagens, de uma lista incompleta. A lista nova tem 14
 * e inclui os 4 — então este script **acrescenta** os que faltam em vez de
 * refazer o elenco. Refazer significaria apagar personagem e participação para
 * recriar iguais, e apagar histórico para reescrever o mesmo conteúdo é risco
 * sem ganho.
 *
 * `ordem` segue a posição na lista recebida, inclusive nos que já existiam.
 * A posição 4 (João) fica vazia de propósito: falta saber qual Lucas é, e
 * deixar o lugar reservado evita renumerar tudo quando ele chegar.
 *
 *   node scripts/completar-ele-e.mjs            confere
 *   node scripts/completar-ele-e.mjs --aplicar  grava
 */
import { db } from "./firebase-admin-app.mjs";

const TIPO = {
  Principal: "protagonista",
  Antagonista: "antagonista",
  "Participação Especial": "especial",
  Narrador: "narrador",
  Figurante: "figurante",
};

const MESMA_PESSOA = {
  "pedro castanho": "Pedro Henrique Ferreira Castanho",
  // "Cleito Tejada" na lista; a ficha é "Cleiton Tejada".
  "cleito tejada": "Cleiton Tejada",
  "luis furlan": "Luís Furlan",
};

/*
 * Elenco na ordem da lista. Grafia corrigida: "Espirito Santos" → "Espírito
 * Santo" e "Judas Inscariotes" → "Judas Iscariotes".
 *
 * `Carlos Dias - Jesus` aparecia duas vezes na lista; entra uma. Duas criariam
 * dois personagens idênticos e duas participações para a mesma pessoa.
 *
 * A posição 4 é o "João": a lista diz só "Lucas", e existem "Lucas Produção" e
 * "Lucas Stocco". Confirmado que é uma terceira pessoa, ainda sem sobrenome.
 */
const ELENCO = [
  { ordem: 0, pessoa: "Cleito Tejada", personagem: "Deus", tipo: "Participação Especial" },
  { ordem: 1, pessoa: "Guilherme Carvalho", personagem: "Espírito Santo", tipo: "Participação Especial" },
  { ordem: 2, pessoa: "Carlos Dias", personagem: "Jesus", tipo: "Principal" },
  { ordem: 3, pessoa: "Pedro Castanho", personagem: "Pedro", tipo: "Principal" },
  // ordem 4 reservada: João.
  { ordem: 5, pessoa: "Guilherme Diana", personagem: "Thiago", tipo: "Participação Especial" },
  { ordem: 6, pessoa: "Lucas Stocco", personagem: "Mateus", tipo: "Figurante" },
  { ordem: 7, pessoa: "Davi Fogaça", personagem: "André", tipo: "Figurante" },
  { ordem: 8, pessoa: "Nicolas Henrique", personagem: "Judas Tadeu", tipo: "Figurante" },
  { ordem: 9, pessoa: "Luan Oliveira", personagem: "Judas Iscariotes", tipo: "Figurante" },
  { ordem: 10, pessoa: "Luis Furlan", personagem: "Tomé", tipo: "Figurante" },
  { ordem: 11, pessoa: "Felipe Furlan", personagem: "Filipe", tipo: "Figurante" },
  { ordem: 12, pessoa: "Leonardo Macedo", personagem: "Cléofas", tipo: "Participação Especial" },
  { ordem: 13, pessoa: "Agleston Teruo", personagem: "Narrador", tipo: "Narrador" },
];

const aplicar = process.argv.includes("--aplicar");
const normalizar = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const canonico = (n) => MESMA_PESSOA[normalizar(n)] ?? n.replace(/\s+/g, " ").trim();

const peca = (await db.collection("plays").where("titulo", "==", "Ele É").get()).docs[0];
if (!peca) throw new Error('Peça "Ele É" não encontrada.');
const dadosPeca = peca.data();

const pessoas = await db.collection("people").get();
const idPorNome = new Map(pessoas.docs.map((d) => [normalizar(d.data().nome ?? ""), d.id]));

const chars = await peca.ref.collection("characters").get();
const existentePorNome = new Map(chars.docs.map((d) => [normalizar(d.data().nome), d]));

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

// Pessoas que faltam.
const faltando = [
  ...new Set(
    ELENCO.map((e) => canonico(e.pessoa)).filter((n) => !idPorNome.has(normalizar(n))),
  ),
];
console.log(`PESSOAS — ${faltando.length} a criar`);
faltando.forEach((n) => console.log(`   ${n}`));
if (aplicar && faltando.length > 0) {
  const lote = db.batch();
  const agora = new Date().toISOString();
  for (const nome of faltando) {
    const ref = db.collection("people").doc();
    lote.set(ref, { nome, email: "", telefone: "", fotoUrl: "", ativo: true, criadoEm: agora });
    idPorNome.set(normalizar(nome), ref.id);
  }
  await lote.commit();
}

console.log("\nPERSONAGENS");
const criar = [];
const renumerar = [];
for (const item of ELENCO) {
  const nome = canonico(item.pessoa);
  const jaExiste = existentePorNome.get(normalizar(item.personagem));
  if (jaExiste) {
    const mudaOrdem = jaExiste.data().ordem !== item.ordem;
    console.log(
      `   ${String(item.ordem).padStart(2)} ${item.personagem.padEnd(18)} ${nome.padEnd(34)} existe${mudaOrdem ? ` · ordem ${jaExiste.data().ordem} → ${item.ordem}` : ""}`,
    );
    if (mudaOrdem) renumerar.push({ ref: jaExiste.ref, ordem: item.ordem });
    continue;
  }
  console.log(`   ${String(item.ordem).padStart(2)} ${item.personagem.padEnd(18)} ${nome.padEnd(34)} CRIAR`);
  criar.push({ ...item, nome });
}
console.log(`    4 João               (aguardando o sobrenome do Lucas)        RESERVADO`);
console.log(`\n   ${criar.length} a criar, ${renumerar.length} a renumerar`);

if (!aplicar) {
  console.log("\nRode de novo com --aplicar para gravar.\n");
  process.exit(0);
}

const lote = db.batch();
const agora = new Date().toISOString();
renumerar.forEach((r) => lote.update(r.ref, { ordem: r.ordem }));
for (const item of criar) {
  const personId = idPorNome.get(normalizar(item.nome));
  if (!personId) throw new Error(`Pessoa não resolvida: "${item.nome}"`);
  const tipoPapel = TIPO[item.tipo];
  if (!tipoPapel) throw new Error(`Tipo desconhecido: "${item.tipo}"`);

  const personagemRef = peca.ref.collection("characters").doc();
  lote.set(personagemRef, {
    playId: peca.id,
    nome: item.personagem,
    descricao: "",
    tipoPapel,
    observacoes: "",
    imagemUrl: "",
    personId,
    personNome: item.nome,
    situacao: "confirmado",
    ordem: item.ordem,
  });
  lote.set(db.collection("participations").doc(), {
    personId,
    playId: peca.id,
    playTitulo: dadosPeca.titulo,
    playEvento: dadosPeca.nomeEvento ?? "",
    playCapaUrl: dadosPeca.capaUrl ?? "",
    characterId: personagemRef.id,
    characterNome: item.personagem,
    tipoPapel,
    periodo: dadosPeca.dataApresentacao,
    concluidaEm: agora,
  });
}
await lote.commit();
console.log(`\n   ${criar.length} personagens e participações criados.\n`);
process.exit(0);
