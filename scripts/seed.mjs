/**
 * Cadastra as características de atuação iniciais do briefing, se ainda não
 * existirem. Pode ser executado quantas vezes for necessário.
 *
 *   npm run seed
 */
import { db } from "./firebase-admin-app.mjs";

const INICIAIS = ["Protagonista", "Impõe a voz", "Noção de espaço"];

const existentes = await db.collection("traits").get();
const nomes = new Set(existentes.docs.map((d) => d.data().nome));

let criadas = 0;
let ordem = existentes.size;

for (const nome of INICIAIS) {
  if (nomes.has(nome)) continue;
  await db.collection("traits").add({ nome, ordem: ordem++, ativo: true });
  console.log(`  + ${nome}`);
  criadas += 1;
}

console.log(
  criadas === 0
    ? "\n  As características iniciais já estavam cadastradas.\n"
    : `\n  ${criadas} característica(s) cadastrada(s).\n`,
);
console.log("  Novas características podem ser criadas na tela Pessoas do aplicativo.\n");
process.exit(0);
