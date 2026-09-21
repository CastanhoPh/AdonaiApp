#!/usr/bin/env node
/**
 * Marca como inativa toda pessoa que ainda não tem acesso ao app.
 *
 * "Ativa no grupo" passa a significar "participa e usa o app". Quem está no
 * cadastro só pelo acervo continua no histórico e nas peças, mas sai da
 * convocação de ensaio, do alvo "todos" dos avisos e da contagem de
 * participantes ativos do Painel — que é o efeito desejado: não faz sentido
 * convocar para ensaio quem nem tem conta.
 *
 * A ativação acontece no caminho inverso: ao vincular a conta em Pessoas, a
 * direção marca a pessoa como ativa.
 *
 *   node scripts/inativar-sem-acesso.mjs            confere
 *   node scripts/inativar-sem-acesso.mjs --aplicar  grava
 */
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "marcou como inativa quem entrou só pelo acervo");

const aplicar = process.argv.includes("--aplicar");

const contas = await db.collection("users").get();
const comAcesso = new Set(contas.docs.map((d) => d.data().personId).filter(Boolean));

const pessoas = await db.collection("people").get();
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);
console.log(`  ${pessoas.size} pessoas · ${comAcesso.size} com acesso vinculado\n`);

const inativar = [];
for (const pessoa of pessoas.docs) {
  const v = pessoa.data();
  const temAcesso = comAcesso.has(pessoa.id);
  const ativo = v.ativo !== false;

  if (temAcesso) {
    console.log(`  ${String(v.nome).padEnd(34)} tem acesso · mantida ${ativo ? "ativa" : "inativa"}`);
    continue;
  }
  if (!ativo) {
    console.log(`  ${String(v.nome).padEnd(34)} sem acesso · já estava inativa`);
    continue;
  }
  console.log(`  ${String(v.nome).padEnd(34)} sem acesso · ativa → INATIVA`);
  inativar.push(pessoa.ref);
}

console.log(`\n  ${inativar.length} a inativar`);

if (!aplicar) {
  if (inativar.length > 0) console.log("\n  Rode de novo com --aplicar para gravar.\n");
  process.exit(0);
}
if (inativar.length === 0) {
  console.log("\n  Nada a fazer.\n");
  process.exit(0);
}

// Em lotes de 400: o limite de uma escrita em lote do Firestore é 500.
for (let i = 0; i < inativar.length; i += 400) {
  const lote = db.batch();
  inativar.slice(i, i + 400).forEach((ref) => lote.update(ref, { ativo: false }));
  await lote.commit();
}
console.log(`\n  ${inativar.length} pessoas marcadas como inativas.\n`);
process.exit(0);
