/** Configuração comum às verificações: `.env.local`, endereços e o Chrome. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let cache = null;

export function lerEnv() {
  if (cache) return cache;
  const caminho = resolve(process.cwd(), ".env.local");
  const valores = {};
  if (existsSync(caminho)) {
    for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const i = limpa.indexOf("=");
      if (i === -1) continue;
      const valor = limpa.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (valor) valores[limpa.slice(0, i).trim()] = valor;
    }
  }
  cache = { ...valores, ...process.env };
  return cache;
}

const env = lerEnv();

export const PROJETO = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
export const BUCKET = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
export const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

/**
 * Onde as telas são testadas. O site publicado, por padrão.
 *
 * `ADONAI_SITE=http://localhost:3000` aponta para o `npm run dev` — útil para
 * conferir antes de publicar, com a ressalva de que o service worker e os
 * cabeçalhos de cache só existem de verdade no Hosting.
 */
export const SITE = (env.ADONAI_SITE ?? "https://adonaiapp.web.app").replace(/\/$/, "");

/**
 * O Chrome instalado, não um baixado pelo Playwright.
 *
 * O projeto usa `playwright-core` justamente para não versionar um navegador
 * de 150 MB. `ADONAI_CHROME` cobre quem instalou em outro lugar.
 */
export const CHROME =
  env.ADONAI_CHROME ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((caminho) => existsSync(caminho));
