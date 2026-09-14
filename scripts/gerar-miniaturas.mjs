#!/usr/bin/env node
/**
 * Gera a miniatura das fotos de perfil que já estão no Storage.
 *
 * Fotos novas já sobem com a versão pequena junto, feita no navegador de quem
 * envia. As que já existiam não têm, e são elas que fazem a lista de Pessoas
 * baixar centenas de kB para desenhar círculos de 28 pixels.
 *
 * Por que um navegador aqui: redimensionar imagem precisa de canvas, que o
 * Node não tem. Em vez de trazer uma biblioteca nativa só para três arquivos,
 * o script abre o Chrome que o projeto já usa para testes, manda ele reduzir,
 * e sobe o resultado com a credencial de administrador. É pontual e some
 * depois que todas as fotos tiverem passado por aqui.
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

const LADO = 128;
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

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pendentes = (await db.collection("people").get()).docs.filter(
  (d) => d.data().fotoUrl && !d.data().fotoMiniUrl,
);

if (pendentes.length === 0) {
  console.log("  Todas as fotos já têm miniatura.\n");
  process.exit(0);
}

console.log(`  ${pendentes.length} foto(s) sem miniatura:\n`);

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
async function reduzir(original) {
  const base64 = await pagina.evaluate(
    async ([bytes, lado]) => {
      const binario = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([binario], { type: "image/jpeg" }), {
        imageOrientation: "from-image",
      });
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const tela = document.createElement("canvas");
      tela.width = Math.round(bitmap.width * escala);
      tela.height = Math.round(bitmap.height * escala);
      tela.getContext("2d").drawImage(bitmap, 0, 0, tela.width, tela.height);
      bitmap.close();
      return tela.toDataURL("image/jpeg", 0.85).split(",")[1];
    },
    [original.toString("base64"), LADO],
  );
  return Buffer.from(base64, "base64");
}

let total = 0;
let menor = 0;
for (const pessoa of pendentes) {
  const v = pessoa.data();
  const resposta = await fetch(v.fotoUrl);
  const original = Buffer.from(await resposta.arrayBuffer());
  console.log(`  ${String(v.nome).padEnd(34)} ${Math.round(original.length / 1024)} KB`);
  total += original.length;

  if (!aplicar) continue;

  const pequena = await reduzir(original);
  const caminho = `atores/${pessoa.id}/perfil-mini.jpg`;
  const arquivo = bucket.file(caminho);
  /*
   * Token de download, como o SDK do cliente faz.
   *
   * É assim que as fotos enviadas pelo app funcionam: a URL carrega um token
   * impossível de adivinhar. Deixar o arquivo público resolveria o download e
   * abriria a foto de todo mundo para a internet inteira; URL assinada com
   * validade longa teria o mesmo efeito e ainda expiraria um dia.
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
  await pessoa.ref.update({ fotoMiniUrl: url });
  menor += pequena.length;
  console.log(`     → ${Math.round(pequena.length / 1024)} KB`);
}

if (navegador) await navegador.close();

console.log(
  `\n  ${Math.round(total / 1024)} KB nas originais` +
    (aplicar ? ` · ${Math.round(menor / 1024)} KB nas miniaturas` : ""),
);
if (!aplicar) console.log("\n  Rode de novo com --aplicar para gravar.\n");
process.exit(0);
