#!/usr/bin/env node
/**
 * Gera a versão pequena das imagens que já estão no Storage.
 *
 * Cobre dois casos: a foto de perfil, que aparece nos círculos das listas, e a
 * capa da peça, que aparece no quadrado de 64 da lista da direção. Imagem nova
 * já sobe com a pequena junto, feita no navegador de quem envia. As que já
 * existiam não têm, e são elas que fazem uma tela baixar centenas de kB para
 * desenhar miniaturas.
 *
 * Por que um navegador aqui: redimensionar imagem precisa de canvas, que o
 * Node não tem. Em vez de trazer uma biblioteca nativa só para isso, o script
 * abre o Chrome que o projeto já usa para testes, manda ele reduzir, e sobe o
 * resultado com a credencial de administrador. É pontual e some depois que
 * todas as imagens tiverem passado por aqui.
 *
 *   node scripts/gerar-miniaturas.mjs            confere
 *   node scripts/gerar-miniaturas.mjs --aplicar  grava
 */
import { chromium } from "playwright-core";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

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
const credencial = JSON.parse(readFileSync(resolve(env.GOOGLE_APPLICATION_CREDENTIALS), "utf8"));
const app = initializeApp({
  credential: cert(credencial),
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

/** Igual ao `paraNomeDeArquivo` do app: os dois têm de gerar o mesmo nome. */
function paraNomeDeArquivo(texto, reserva) {
  const limpo = (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return limpo || reserva;
}

/*
 * Os dois tipos de imagem que têm versão pequena, e os números de cada um.
 * Ver `LADO_MINIATURA` e `LADO_MINIATURA_CAPA` em `src/lib/armazenamento.ts` —
 * mudar lá pede mudar aqui.
 */
const TIPOS = [
  {
    rotulo: "fotos de perfil",
    colecao: "people",
    grande: "fotoUrl",
    pequena: "fotoMiniUrl",
    lado: 128,
    nome: (v) => v.nome,
    reserva: "perfil",
    pasta: (id) => `atores/${id}`,
  },
  {
    rotulo: "capas de peça",
    colecao: "plays",
    grande: "capaUrl",
    pequena: "capaMiniUrl",
    lado: 192,
    nome: (v) => v.titulo,
    reserva: "capa",
    pasta: (id) => `pecas/${id}`,
  },
];

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pendentes = [];
for (const tipo of TIPOS) {
  for (const doc of (await db.collection(tipo.colecao).get()).docs) {
    const v = doc.data();
    if (v[tipo.grande] && !v[tipo.pequena]) pendentes.push({ tipo, doc, v });
  }
}

if (pendentes.length === 0) {
  console.log("  Todas as imagens já têm versão pequena.\n");
  process.exit(0);
}

const navegador = aplicar
  ? await chromium.launch({ executablePath: CHROME, headless: true })
  : null;
const pagina = navegador ? await (await navegador.newContext()).newPage() : null;

/**
 * Reduz no navegador e devolve os bytes do JPEG.
 *
 * Os bytes vão daqui para lá, em vez de a página buscar a imagem: a página
 * está em branco, sem origem, e o Storage recusa a requisição dela.
 */
async function reduzir(original, lado) {
  const base64 = await pagina.evaluate(
    async ([bytes, ladoMaximo]) => {
      const binario = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([binario], { type: "image/jpeg" }), {
        imageOrientation: "from-image",
      });
      const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
      const tela = document.createElement("canvas");
      tela.width = Math.round(bitmap.width * escala);
      tela.height = Math.round(bitmap.height * escala);
      tela.getContext("2d").drawImage(bitmap, 0, 0, tela.width, tela.height);
      bitmap.close();
      return tela.toDataURL("image/jpeg", 0.85).split(",")[1];
    },
    [original.toString("base64"), lado],
  );
  return Buffer.from(base64, "base64");
}

let total = 0;
let menor = 0;
let anterior = null;
for (const { tipo, doc, v } of pendentes) {
  if (tipo.rotulo !== anterior) {
    console.log(`  ${tipo.rotulo}`);
    anterior = tipo.rotulo;
  }
  const rotulo = tipo.nome(v);
  const resposta = await fetch(v[tipo.grande]);
  const original = Buffer.from(await resposta.arrayBuffer());
  console.log(`     ${String(rotulo).padEnd(34)} ${Math.round(original.length / 1024)} KB`);
  total += original.length;

  if (!aplicar) continue;

  const pequena = await reduzir(original, tipo.lado);
  const caminho = `${tipo.pasta(doc.id)}/${paraNomeDeArquivo(rotulo, tipo.reserva)}-mini.jpg`;
  const arquivo = bucket.file(caminho);
  /*
   * Token de download, como o SDK do cliente faz.
   *
   * É assim que as imagens enviadas pelo app funcionam: a URL carrega um token
   * impossível de adivinhar. Deixar o arquivo público resolveria o download e
   * abriria a imagem para a internet inteira; URL assinada com validade longa
   * teria o mesmo efeito e ainda expiraria um dia.
   */
  const token = randomUUID();
  await arquivo.save(pequena, {
    contentType: "image/jpeg",
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
  await doc.ref.update({ [tipo.pequena]: url });
  menor += pequena.length;
  console.log(`        → ${Math.round(pequena.length / 1024)} KB  ${caminho.split("/").pop()}`);
}

if (navegador) await navegador.close();

console.log(
  `\n  ${Math.round(total / 1024)} KB nas originais` +
    (aplicar ? ` · ${Math.round(menor / 1024)} KB nas pequenas` : ""),
);

if (aplicar) {
  // Confere que toda URL gravada responde.
  let quebradas = 0;
  for (const tipo of TIPOS) {
    for (const doc of (await db.collection(tipo.colecao).get()).docs) {
      const url = doc.data()[tipo.pequena];
      if (!url) continue;
      const r = await fetch(url);
      if (!r.ok) {
        quebradas++;
        console.log(`  ⚠ ${tipo.nome(doc.data())}: a URL gravada responde ${r.status}`);
      }
    }
  }
  console.log(`  URLs quebradas: ${quebradas}\n`);
} else {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
}
process.exit(0);
