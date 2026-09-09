/**
 * Inicialização do Firebase Admin para os scripts de linha de comando.
 * As credenciais vêm de GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON da conta
 * de serviço) e o projeto de NEXT_PUBLIC_FIREBASE_PROJECT_ID, ambos lidos do
 * .env.local para não repetir configuração.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** Lê pares CHAVE=valor de um arquivo .env simples. */
function carregarEnv(arquivo) {
  const caminho = resolve(process.cwd(), arquivo);
  if (!existsSync(caminho)) return {};
  const valores = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const separador = limpa.indexOf("=");
    if (separador === -1) continue;
    const chave = limpa.slice(0, separador).trim();
    const valor = limpa.slice(separador + 1).trim().replace(/^["']|["']$/g, "");
    if (valor) valores[chave] = valor;
  }
  return valores;
}

const env = { ...carregarEnv(".env.local"), ...process.env };

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const credenciais = env.GOOGLE_APPLICATION_CREDENTIALS;

export function encerrarCom(mensagem) {
  console.error(`\n  ${mensagem}\n`);
  process.exit(1);
}

if (!projectId) {
  encerrarCom(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID não encontrado. Preencha o .env.local antes de rodar este script.",
  );
}

if (!credenciais || !existsSync(resolve(process.cwd(), credenciais))) {
  encerrarCom(
    "Arquivo da conta de serviço não encontrado.\n" +
      "  Gere a chave em Configurações do projeto › Contas de serviço › Gerar nova chave privada\n" +
      "  e aponte GOOGLE_APPLICATION_CREDENTIALS para o arquivo JSON no .env.local.",
  );
}

const conta = JSON.parse(readFileSync(resolve(process.cwd(), credenciais), "utf8"));

const app = initializeApp({ credential: cert(conta), projectId });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const PROJECT_ID = projectId;
