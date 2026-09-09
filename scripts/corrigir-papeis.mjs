#!/usr/bin/env node
/**
 * Correções em personagens já cadastrados.
 *
 * Cada correção toca em dois lugares: o personagem, em
 * `plays/{id}/characters/{id}`, e a cópia dele na participação, que guarda
 * `characterNome` e `tipoPapel` para o histórico não depender de a peça
 * continuar existindo. Corrigir só o personagem deixaria o histórico da pessoa
 * mostrando o nome e o tipo antigos — que é justamente onde ela olha.
 *
 * A peça é encontrada pelo título e o personagem pelo nome atual; cada
 * correção declara o valor que espera achar e é pulada se não achar, então
 * correção já aplicada não sobrescreve nada às cegas.
 *
 *   node scripts/corrigir-papeis.mjs            confere
 *   node scripts/corrigir-papeis.mjs --aplicar  grava
 */
import { db } from "./firebase-admin-app.mjs";

const CORRECOES = [
  {
    peca: "Mudança de Vida",
    personagem: "Crente Afastado",
    campo: "tipoPapel",
    de: "protagonista",
    para: "especial",
  },
  {
    peca: "Quem Deus Diz que Somos II",
    personagem: "Ex Namorado",
    campo: "nome",
    de: "Ex Namorado",
    para: "Ex Namorado da Amanda",
  },
];

/** O campo do personagem e o nome equivalente na participação. */
const NA_PARTICIPACAO = { nome: "characterNome", tipoPapel: "tipoPapel" };

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pecas = await db.collection("plays").get();
const pecaPorTitulo = new Map(pecas.docs.map((d) => [d.data().titulo, d]));

let mudancas = 0;
for (const c of CORRECOES) {
  const peca = pecaPorTitulo.get(c.peca);
  if (!peca) {
    console.log(`  ${c.personagem.padEnd(20)} PULA — peça "${c.peca}" não encontrada`);
    continue;
  }

  const chars = await peca.ref.collection("characters").get();
  const alvo = chars.docs.find((d) => d.data().nome === c.personagem);
  if (!alvo) {
    const jaTem = chars.docs.some((d) => d.data()[c.campo] === c.para);
    console.log(
      `  ${c.personagem.padEnd(20)} PULA — ${jaTem ? "já corrigido" : "personagem não encontrado"}`,
    );
    continue;
  }

  const atual = alvo.data()[c.campo];
  if (atual === c.para) {
    console.log(`  ${c.personagem.padEnd(20)} já está "${c.para}"`);
    continue;
  }
  if (atual !== c.de) {
    console.log(`  ${c.personagem.padEnd(20)} PULA — ${c.campo} é "${atual}", esperava "${c.de}"`);
    continue;
  }

  const ligadas = await db.collection("participations").where("characterId", "==", alvo.id).get();
  console.log(
    `  ${c.personagem.padEnd(20)} ${c.peca} · ${c.campo}: "${atual}" → "${c.para}"` +
      ` · ${ligadas.size} participação(ões)`,
  );
  mudancas++;

  if (!aplicar) continue;
  const lote = db.batch();
  lote.update(alvo.ref, { [c.campo]: c.para });
  ligadas.docs.forEach((x) => lote.update(x.ref, { [NA_PARTICIPACAO[c.campo]]: c.para }));
  await lote.commit();
}

console.log(`\n  ${mudancas} correção(ões) ${aplicar ? "aplicada(s)" : "a aplicar"}`);
if (!aplicar && mudancas > 0) console.log("\n  Rode de novo com --aplicar para gravar.\n");
process.exit(0);
