#!/usr/bin/env node
/**
 * Correções no acervo: nome de pessoa e situação do elenco de cada peça.
 *
 * Renomear pessoa toca em mais de um lugar. O nome fica em `people/{id}.nome`,
 * mas também aparece copiado em `characters.personNome`, para a tela de elenco
 * não precisar buscar a pessoa de cada papel. Corrigir só a ficha deixaria o
 * nome antigo nas peças — e o histórico apontando para a pessoa certa com o
 * rótulo errado.
 *
 * Só escreve com --aplicar. Cada mudança declara o valor que espera encontrar.
 *
 *   node scripts/corrigir-acervo.mjs
 *   node scripts/corrigir-acervo.mjs --aplicar
 */
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "corrigiu dados das peças carregadas em lote");

/*
 * Nomes que entraram errados por causa das listas anteriores, corrigidos pela
 * lista mais recente. Não é merge: em nenhum dos casos existe ficha com o nome
 * novo, então renomear basta — o histórico e os personagens continuam
 * apontando para a mesma ficha.
 */
const RENOMEAR = [
  { de: "Liu Macedo", para: "Leonardo Macedo" },
  { de: "Weslley Ribeiro", para: "Weslley Ferreira" },
  { de: "Bia Batista", para: "Beatriz Batista" },
];

/*
 * Elenco fechado por peça, conforme a lista recebida. Ausente da lista =
 * mantido como está.
 */
const ELENCO = {
  "Rede Mil": false,
  "Ele É": false,
  // Título como está hoje no app; a lista chama de "A História de Moises".
  "A História de José do Egito": true,
  "Jardim Secreto": true,
  "Filho Pródigo": true,
  "A Recompensa": false,
  "Nascimento de Jesus": true,
  "Além do Céu Azul": true,
  "Quem Deus Diz que Somos I": true,
  "A Resposta": false,
  "Está Consumado": false,
  "Paçoca, Franjinha e Grandão no Avalanche": true,
  "Quem Deus Diz que Somos II": true,
  "Quem Deus Diz que Somos III": true,
};

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

/* ------------------------------------------------------- renomear pessoas */

console.log("RENOMEAR PESSOA");
const pessoas = await db.collection("people").get();
for (const { de, para } of RENOMEAR) {
  const alvo = pessoas.docs.find((d) => d.data().nome === de);
  if (!alvo) {
    const jaTem = pessoas.docs.some((d) => d.data().nome === para);
    console.log(`  "${de}" → "${para}": PULA — ${jaTem ? "já está renomeada" : "não encontrada"}`);
    continue;
  }

  // Onde o nome aparece copiado.
  const copias = [];
  for (const peca of (await db.collection("plays").get()).docs) {
    const chars = await peca.ref.collection("characters").get();
    chars.docs
      .filter((c) => c.data().personNome === de)
      .forEach((c) => copias.push({ ref: c.ref, onde: `${peca.data().titulo} › ${c.data().nome}` }));
  }

  console.log(`  "${de}" → "${para}"`);
  console.log(`     ficha: people/${alvo.id}`);
  console.log(`     cópias em personagens: ${copias.length}`);
  copias.forEach((c) => console.log(`        ${c.onde}`));

  if (!aplicar) continue;
  const lote = db.batch();
  lote.update(alvo.ref, { nome: para });
  copias.forEach((c) => lote.update(c.ref, { personNome: para }));
  await lote.commit();

  // A conta de acesso guarda o próprio nome, usado como reserva na interface.
  const contas = await db.collection("users").where("personId", "==", alvo.id).get();
  for (const conta of contas.docs) {
    if (conta.data().nome === de) {
      await conta.ref.update({ nome: para });
      console.log(`     conta ${conta.data().email} também atualizada`);
    }
  }
  console.log("     aplicado");
}

/* --------------------------------------------------- situação do elenco */

console.log("\nSITUAÇÃO DO ELENCO");
const pecas = await db.collection("plays").get();
const lote = db.batch();
let mudancas = 0;

for (const peca of pecas.docs) {
  const titulo = peca.data().titulo;
  if (!(titulo in ELENCO)) {
    console.log(`  ${titulo.padEnd(32)} PULA — fora da lista`);
    continue;
  }
  const desejado = ELENCO[titulo];
  const atual = peca.data().elencoFechado ?? false;
  if (atual === desejado) {
    console.log(`  ${titulo.padEnd(32)} já está ${desejado ? "fechado" : "em aberto"}`);
    continue;
  }
  console.log(`  ${titulo.padEnd(32)} ${atual ? "fechado" : "em aberto"} → ${desejado ? "fechado" : "em aberto"}`);
  lote.update(peca.ref, { elencoFechado: desejado });
  mudancas++;
}

if (aplicar && mudancas > 0) {
  await lote.commit();
  console.log(`\n  ${mudancas} peça(s) atualizada(s).`);
} else if (!aplicar) {
  console.log(`\n  ${mudancas} peça(s) a atualizar.`);
  console.log("\nRode de novo com --aplicar para gravar.\n");
}
process.exit(0);
