#!/usr/bin/env node
/**
 * Escreve o histórico que faltou em peças já encerradas.
 *
 * O histórico nasce no momento de concluir a peça. Quem é escalado **depois**
 * disso — a direção lembrando de alguém que fez um papel numa peça de anos
 * atrás, cadastrando o personagem e escalando — não passava por esse momento e
 * ficava de fora da própria participação. Sem erro, e sem ninguém perceber até
 * contar as peças de alguém.
 *
 * `escalarPessoa` passou a gravar na hora quando a peça está encerrada. Este
 * script resolve os que já estavam no banco antes disso.
 *
 *   node scripts/aplicados/completar-historico.mjs            confere
 *   node scripts/aplicados/completar-historico.mjs --aplicar  grava
 */
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "criou as participações que faltavam em peças encerradas");

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const participacoes = (await db.collection("participations").get()).docs.map((d) => d.data());
const jaTem = new Set(participacoes.map((p) => `${p.playId}:${p.characterId}`));

const faltando = [];
for (const peca of (await db.collection("plays").get()).docs) {
  const v = peca.data();
  if (!["concluida", "arquivada"].includes(v.status)) continue;
  for (const papel of (await peca.ref.collection("characters").get()).docs) {
    const c = papel.data();
    if (!c.personId) continue;
    if (jaTem.has(`${peca.id}:${papel.id}`)) continue;
    faltando.push({ peca: { id: peca.id, ...v }, papel: { id: papel.id, ...c } });
  }
}

if (faltando.length === 0) {
  console.log("  Nenhum papel de peça encerrada está fora do histórico.\n");
  process.exit(0);
}

const pessoas = {};
for (const p of (await db.collection("people").get()).docs) pessoas[p.id] = p.data().nome;

for (const { peca, papel } of faltando) {
  console.log(
    `  ${String(pessoas[papel.personId] ?? papel.personId).padEnd(26)} ${peca.titulo} › ${papel.nome}`,
  );
}
console.log(`\n  ${faltando.length} participação(ões) a criar`);

if (!aplicar) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
  process.exit(0);
}

const agora = new Date().toISOString();
const lote = db.batch();
for (const { peca, papel } of faltando) {
  lote.set(db.collection("participations").doc(), {
    personId: papel.personId,
    playId: peca.id,
    playTitulo: peca.titulo,
    playEvento: peca.nomeEvento ?? "",
    playCapaUrl: peca.capaUrl ?? "",
    characterId: papel.id,
    characterNome: papel.nome,
    tipoPapel: papel.tipoPapel,
    periodo: peca.dataApresentacao || agora.slice(0, 10),
    concluidaEm: agora,
  });
}
await lote.commit();

const depois = (await db.collection("participations").get()).size;
console.log(`\n  ${faltando.length} criadas · ${depois} participações no total\n`);
process.exit(0);
