#!/usr/bin/env node
/**
 * Move as características de atuação para fora do alcance do participante.
 *
 * De:  people/{id}.caracteristicas
 *      plays/{playId}/characters/{id}.caracteristicasDesejadas
 * Para: direcao/caracteristicas  { pessoas: {...}, papeis: {...} }
 *
 * O motivo está nas regras: `people` e `characters` são legíveis por qualquer
 * autenticado, porque o participante precisa deles para ver nomes em
 * convocação, presença e elenco. Guardar ali a avaliação que a direção faz das
 * pessoas significava entregá-la a quem abrisse as ferramentas do navegador.
 *
 * Ordem de propósito: grava o documento novo, confere que ele ficou igual ao
 * que foi lido, e só então apaga os campos antigos. Se algo falhar no meio, o
 * dado antigo ainda está lá.
 *
 * Uso:
 *   node scripts/migrar-caracteristicas.mjs            confere e mostra o plano
 *   node scripts/migrar-caracteristicas.mjs --aplicar  executa
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin-app.mjs";

const aplicar = process.argv.includes("--aplicar");

const pessoas = {};
const papeis = {};
const limparPessoas = [];
const limparPapeis = [];

const snapPessoas = await db.collection("people").get();
for (const d of snapPessoas.docs) {
  const ids = d.data().caracteristicas;
  if (!Array.isArray(ids)) continue;
  if (ids.length > 0) pessoas[d.id] = ids;
  limparPessoas.push({ ref: d.ref, nome: d.data().nome ?? d.id, quantas: ids.length });
}

const snapPecas = await db.collection("plays").get();
for (const peca of snapPecas.docs) {
  const personagens = await peca.ref.collection("characters").get();
  for (const d of personagens.docs) {
    const ids = d.data().caracteristicasDesejadas;
    if (!Array.isArray(ids)) continue;
    if (ids.length > 0) papeis[d.id] = ids;
    limparPapeis.push({
      ref: d.ref,
      nome: `${peca.data().titulo ?? peca.id} › ${d.data().nome ?? d.id}`,
      quantas: ids.length,
    });
  }
}

// Nomes das características, só para o relatório ficar legível.
const rotulos = {};
for (const d of (await db.collection("traits").get()).docs) rotulos[d.id] = d.data()?.nome;
const nomear = (ids) => ids.map((i) => rotulos[i] ?? i).join(", ");

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);
console.log(`pessoas com característica: ${Object.keys(pessoas).length}`);
for (const p of limparPessoas) {
  console.log(`  ${p.nome.padEnd(34)} ${p.quantas ? nomear(pessoas[p.ref.id] ?? []) : "(nenhuma)"}`);
}
console.log(`\npapéis com característica desejada: ${Object.keys(papeis).length}`);
for (const p of limparPapeis) {
  console.log(`  ${p.nome.padEnd(34)} ${p.quantas ? nomear(papeis[p.ref.id] ?? []) : "(nenhuma)"}`);
}
console.log(
  `\ncampos a remover depois de gravar: ${limparPessoas.length} em people, ` +
    `${limparPapeis.length} em characters`,
);

if (!aplicar) {
  console.log("\nRode de novo com --aplicar para executar.");
  process.exit(0);
}

// 1. Grava o destino.
const destino = db.collection("direcao").doc("caracteristicas");
await destino.set({ pessoas, papeis, migradoEm: new Date().toISOString() }, { merge: true });
console.log("\n1/3 direcao/caracteristicas gravado");

// 2. Confere que o que está gravado é o que foi lido, antes de apagar nada.
const gravado = (await destino.get()).data() ?? {};
const igual = (a = {}, b = {}) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

if (!igual(gravado.pessoas, pessoas) || !igual(gravado.papeis, papeis)) {
  console.error("2/3 FALHOU: o gravado não corresponde ao lido. Nada foi removido.");
  process.exit(1);
}
console.log("2/3 conferido: o destino corresponde ao lido");

// 3. Só agora remove os campos antigos.
let lote = db.batch();
let pendentes = 0;
const enfileirar = async (ref, campo) => {
  lote.update(ref, { [campo]: FieldValue.delete() });
  if (++pendentes === 400) {
    await lote.commit();
    lote = db.batch();
    pendentes = 0;
  }
};
for (const p of limparPessoas) await enfileirar(p.ref, "caracteristicas");
for (const p of limparPapeis) await enfileirar(p.ref, "caracteristicasDesejadas");
if (pendentes > 0) await lote.commit();
console.log(`3/3 campos antigos removidos (${limparPessoas.length + limparPapeis.length})`);

console.log("\nPronto. O participante já não alcança as características.");
process.exit(0);
