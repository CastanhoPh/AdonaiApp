#!/usr/bin/env node
/**
 * Correções pontuais no acervo já cadastrado.
 *
 * Separado de `subir-pecas-antigas.mjs` de propósito: aquele cria, este altera
 * o que existe. Misturar os dois num script só faria "rodar de novo" ser uma
 * operação com dois significados.
 *
 * Cada correção diz o que espera encontrar antes de escrever. Se o valor atual
 * não for o esperado, a peça é pulada e avisada — assim uma correção já
 * aplicada, ou um dado editado à mão na tela, não é sobrescrita às cegas.
 *
 *   node scripts/corrigir-pecas.mjs            confere
 *   node scripts/corrigir-pecas.mjs --aplicar  grava
 */
import { db } from "./firebase-admin-app.mjs";

/**
 * `campo` é o que muda; `de` é o valor que precisa estar lá hoje.
 * A peça é encontrada por título — único no acervo.
 */
const CORRECOES = [
  /*
   * Título trocado: a peça de Convenção 2024 é a história de Moisés, não a de
   * José do Egito. Com acento, seguindo o pedido de corrigir o português —
   * "Moises" veio sem acento na lista, como "Pascoa".
   */
  {
    titulo: "A História de José do Egito",
    campo: "titulo",
    de: "A História de José do Egito",
    para: "A História de Moisés",
  },
  { titulo: "Ele É", campo: "nomeEvento", de: "Pascoa 2024", para: "Páscoa 2024" },
  { titulo: "A Recompensa", campo: "nomeEvento", de: "Pascoa 2025", para: "Páscoa 2025" },
  { titulo: "Está Consumado", campo: "nomeEvento", de: "Pascoa 2026", para: "Páscoa 2026" },
];

const aplicar = process.argv.includes("--aplicar");

const pecas = await db.collection("plays").get();
const porTitulo = new Map(pecas.docs.map((d) => [d.data().titulo, d]));

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const lote = db.batch();
let mudancas = 0;

for (const c of CORRECOES) {
  const documento = porTitulo.get(c.titulo);
  if (!documento) {
    console.log(`  ${c.titulo.padEnd(28)} PULA — peça não encontrada`);
    continue;
  }
  const atual = documento.data()[c.campo];
  if (atual === c.para) {
    console.log(`  ${c.titulo.padEnd(28)} já corrigida ("${atual}")`);
    continue;
  }
  if (atual !== c.de) {
    console.log(
      `  ${c.titulo.padEnd(28)} PULA — ${c.campo} é "${atual}", esperava "${c.de}"`,
    );
    continue;
  }
  console.log(`  ${c.titulo.padEnd(28)} ${c.campo}: "${atual}" → "${c.para}"`);
  lote.update(documento.ref, { [c.campo]: c.para });
  mudancas++;
}

console.log(`\n  ${mudancas} correção(ões) ${aplicar ? "aplicada(s)" : "a aplicar"}`);

if (!aplicar) {
  if (mudancas > 0) console.log("\n  Rode de novo com --aplicar para gravar.\n");
  process.exit(0);
}
if (mudancas === 0) {
  console.log("\n  Nada a fazer.\n");
  process.exit(0);
}

await lote.commit();

/*
 * A participação copia título e evento da peça no momento em que é criada, para
 * o histórico não depender de a peça continuar existindo. Corrigir a peça sem
 * corrigir a cópia deixaria o histórico com o texto antigo.
 */
let participacoes = 0;
for (const c of CORRECOES) {
  const documento = porTitulo.get(c.titulo);
  if (!documento) continue;
  const ligadas = await db.collection("participations").where("playId", "==", documento.id).get();
  for (const x of ligadas.docs) {
    const campoNaCopia = c.campo === "nomeEvento" ? "playEvento" : "playTitulo";
    if (x.data()[campoNaCopia] !== c.de) continue;
    await x.ref.update({ [campoNaCopia]: c.para });
    participacoes++;
  }
}
console.log(`  ${participacoes} participação(ões) no histórico atualizada(s).\n`);
process.exit(0);
