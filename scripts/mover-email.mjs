#!/usr/bin/env node
/**
 * Tira o e-mail da ficha que todo o elenco lê.
 *
 * `people` é legível por qualquer conta — a lista de elenco precisa de nome e
 * foto —, então o endereço de todo mundo estava à vista de todo mundo. Vai
 * para `people/{id}/privado/contato`, junto com telefone, nascimento e o
 * contato do responsável, que fizeram esse caminho antes.
 *
 * Ele ficou para trás na primeira mudança porque servia para o app ligar conta
 * nova à pessoa cadastrada com o mesmo endereço. Esse vínculo automático
 * deixou de existir — a direção liga à mão, e o convite já vem ligado —, então
 * hoje ele é só contato.
 *
 * Duas etapas por pessoa, nesta ordem: grava no destino, depois apaga da
 * ficha. Se parar no meio, o dado existe nos dois lugares — chato, e
 * recuperável. A ordem inversa perderia o e-mail.
 *
 *   node scripts/mover-email.mjs            confere
 *   node scripts/mover-email.mjs --aplicar  grava
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin-app.mjs";

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pessoas = await db.collection("people").get();
let movidos = 0;
let vazios = 0;
let jaEmOrdem = 0;

for (const pessoa of pessoas.docs) {
  const v = pessoa.data();
  if (v.email === undefined) {
    jaEmOrdem++;
    continue;
  }

  const email = String(v.email).trim().toLowerCase();
  console.log(`  ${String(v.nome).padEnd(34)} ${email || "(vazio)"}`);
  if (email) movidos++;
  else vazios++;

  if (!aplicar) continue;

  // 1. Destino primeiro. Campo vazio não vale a pena guardar.
  if (email) {
    await pessoa.ref.collection("privado").doc("contato").set({ email }, { merge: true });
  }
  // 2. Só então sai da ficha.
  await pessoa.ref.update({ email: FieldValue.delete() });
}

console.log(
  `\n  ${pessoas.size} pessoas · ${movidos} com e-mail movido · ` +
    `${vazios} com campo vazio limpo · ${jaEmOrdem} já em ordem`,
);

if (aplicar) {
  const depois = await db.collection("people").get();
  const sobraram = depois.docs.filter((d) => d.data().email !== undefined);
  console.log(
    `\n  ${
      sobraram.length === 0
        ? "nenhuma ficha tem mais e-mail"
        : `${sobraram.length} ainda têm: ${sobraram.map((d) => d.data().nome).join(", ")}`
    }`,
  );

  // Confere que ninguém perdeu o endereço no caminho.
  let perdidos = 0;
  for (const pessoa of pessoas.docs) {
    const antes = String(pessoa.data().email ?? "").trim().toLowerCase();
    if (!antes) continue;
    const contato = await pessoa.ref.collection("privado").doc("contato").get();
    if (contato.data()?.email !== antes) {
      perdidos++;
      console.log(`  ⚠ ${pessoa.data().nome}: o e-mail não chegou ao destino`);
    }
  }
  console.log(`  e-mails perdidos: ${perdidos}\n`);
} else if (movidos + vazios > 0) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
}
process.exit(0);
