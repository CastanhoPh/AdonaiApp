#!/usr/bin/env node
/**
 * Põe o nome de quem é a imagem no nome do arquivo.
 *
 *   atores/{id}/perfil.jpg          →  atores/{id}/pedro-castanho.jpg
 *   atores/{id}/perfil-mini.jpg     →  atores/{id}/pedro-castanho-mini.jpg
 *   pecas/{id}/capa.jpg             →  pecas/{id}/jardim-secreto.jpg
 *   pecas/{id}/{personagem}/foto.jpg → pecas/{id}/{personagem}/carioca.jpg
 *
 * A pasta continua sendo o id. É ela que a regra de segurança compara com o
 * token para decidir quem pode trocar o quê, e identificador que sustenta
 * permissão não pode depender de como alguém se chama hoje. O nome no arquivo
 * é rótulo, para quem abre o Storage reconhecer o que está vendo.
 *
 * Renomear no Storage é copiar e apagar, e o endereço de download muda junto —
 * por isso o script também atualiza o campo que aponta para ele no Firestore.
 * A ordem é: copia, aponta a ficha para a cópia, só então apaga o original. Se
 * parar no meio, sobra um arquivo a mais, que é recuperável; a ordem inversa
 * deixaria a ficha apontando para o nada.
 *
 *   node scripts/renomear-imagens.mjs            confere
 *   node scripts/renomear-imagens.mjs --aplicar  grava
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function lerEnv(arquivo) {
  const valores = {};
  for (const linha of readFileSync(resolve(arquivo), "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const i = limpa.indexOf("=");
    if (i === -1) continue;
    const valor = limpa.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (valor) valores[limpa.slice(0, i).trim()] = valor;
  }
  return valores;
}

const env = lerEnv(".env.local");
const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(resolve(env.GOOGLE_APPLICATION_CREDENTIALS), "utf8"))),
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

/** Igual ao `paraNomeDeArquivo` do app: os dois têm de gerar o mesmo nome. */
function paraNomeDeArquivo(texto, reserva) {
  const limpo = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return limpo || reserva;
}

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

/* ----------------------------------------------- o que renomear, e para quê */
const tarefas = [];

for (const pessoa of (await db.collection("people").get()).docs) {
  const v = pessoa.data();
  const base = paraNomeDeArquivo(v.nome, "perfil");
  if (v.fotoUrl) {
    tarefas.push({
      de: `atores/${pessoa.id}/perfil.jpg`,
      para: `atores/${pessoa.id}/${base}.jpg`,
      ref: pessoa.ref,
      campo: "fotoUrl",
      quem: v.nome,
    });
  }
  if (v.fotoMiniUrl) {
    tarefas.push({
      de: `atores/${pessoa.id}/perfil-mini.jpg`,
      para: `atores/${pessoa.id}/${base}-mini.jpg`,
      ref: pessoa.ref,
      campo: "fotoMiniUrl",
      quem: `${v.nome} (miniatura)`,
    });
  }
}

for (const peca of (await db.collection("plays").get()).docs) {
  const v = peca.data();
  if (v.capaUrl) {
    tarefas.push({
      de: `pecas/${peca.id}/capa.jpg`,
      para: `pecas/${peca.id}/${paraNomeDeArquivo(v.titulo, "capa")}.jpg`,
      ref: peca.ref,
      campo: "capaUrl",
      quem: `capa de ${v.titulo}`,
    });
  }
  for (const papel of (await peca.ref.collection("characters").get()).docs) {
    const c = papel.data();
    if (!c.imagemUrl) continue;
    tarefas.push({
      de: `pecas/${peca.id}/${papel.id}/foto.jpg`,
      para: `pecas/${peca.id}/${papel.id}/${paraNomeDeArquivo(c.nome, "foto")}.jpg`,
      ref: papel.ref,
      campo: "imagemUrl",
      quem: `${v.titulo} › ${c.nome}`,
    });
  }
}

/* -------------------------------------------------------------- a mudança */
let feitas = 0;
let pulos = 0;

for (const t of tarefas) {
  if (t.de === t.para) {
    pulos++;
    continue;
  }
  const original = bucket.file(t.de);
  if (!(await original.exists())[0]) {
    console.log(`  ${t.quem.padEnd(38)} PULA — ${t.de} não existe`);
    pulos++;
    continue;
  }

  console.log(`  ${t.quem.padEnd(38)} ${t.de.split("/").pop()} → ${t.para.split("/").pop()}`);
  feitas++;
  if (!aplicar) continue;

  // 1. Copia, com token de download próprio (o endereço muda de qualquer forma).
  const token = randomUUID();
  await original.copy(bucket.file(t.para));
  const copia = bucket.file(t.para);
  await copia.setMetadata({
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
    metadata: { firebaseStorageDownloadTokens: token },
  });
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(t.para)}?alt=media&token=${token}`;

  // 2. Aponta a ficha para a cópia, antes de apagar o original.
  await t.ref.update({ [t.campo]: url });

  // 3. Agora sim.
  await original.delete();
  console.log(`     movido`);
}

console.log(`\n  ${feitas} arquivo(s) ${aplicar ? "renomeado(s)" : "a renomear"} · ${pulos} já em ordem`);

if (aplicar) {
  // Confere que toda URL guardada responde e que nada ficou com nome antigo.
  let quebradas = 0;
  for (const t of tarefas) {
    const doc = await t.ref.get();
    const url = doc.data()[t.campo];
    if (!url) continue;
    const r = await fetch(url);
    if (!r.ok) {
      quebradas++;
      console.log(`  ⚠ ${t.quem}: a URL guardada responde ${r.status}`);
    }
  }
  const [restantes] = await bucket.getFiles();
  const antigos = restantes.filter((f) => /\/(perfil|perfil-mini|capa|foto)\.jpg$/.test(f.name));
  console.log(`\n  URLs quebradas: ${quebradas}`);
  console.log(`  arquivos ainda com nome antigo: ${antigos.length}${antigos.length ? " — " + antigos.map((f) => f.name).join(", ") : ""}`);
} else if (feitas > 0) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
}
process.exit(0);
