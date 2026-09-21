#!/usr/bin/env node
/**
 * Move telefone, nascimento e contato do responsável para fora da ficha.
 *
 * `people` é lido por todo o elenco — a lista de elenco precisa de nome e
 * foto —, então esses campos estavam à vista de todo mundo, inclusive o
 * telefone do responsável de uma menor de idade. Passam para
 * `people/{id}/privado/contato`, que só a direção e a própria pessoa leem.
 *
 * Duas etapas por pessoa, nesta ordem: primeiro grava o contato, depois apaga
 * os campos da ficha. Se o script parar no meio, o dado existe nos dois
 * lugares — que é chato, mas recuperável. A ordem inversa perderia o dado.
 *
 *   node scripts/mover-contato.mjs            confere
 *   node scripts/mover-contato.mjs --aplicar  grava
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "tirou telefone, nascimento e responsável da ficha pública");

const CAMPOS = ["telefone", "nascimento", "responsavelNome", "responsavelTelefone"];

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pessoas = await db.collection("people").get();
let aMover = 0;
let jaMovidas = 0;
let vazias = 0;

for (const pessoa of pessoas.docs) {
  const v = pessoa.data();
  const contato = {};
  for (const campo of CAMPOS) {
    if (v[campo] !== undefined && v[campo] !== "") contato[campo] = v[campo];
  }

  /*
   * Campo presente porém vazio não tem o que mover, mas sai da ficha do mesmo
   * jeito: não guarda informação nenhuma, as regras já não permitem escrever
   * ali, e deixá-lo manteria duas formas do mesmo cadastro.
   */
  const presentes = CAMPOS.filter((c) => v[c] !== undefined);
  if (presentes.length === 0) {
    const destino = await pessoa.ref.collection("privado").doc("contato").get();
    if (destino.exists) jaMovidas++;
    continue;
  }

  const comDado = Object.keys(contato);
  console.log(
    `  ${String(v.nome).padEnd(34)} ${comDado.length ? comDado.join(", ") : "(campos vazios)"}`,
  );
  if (comDado.length) aMover++;
  else vazias++;

  if (!aplicar) continue;

  // 1. Grava no destino, mesclando com o que já houver.
  if (comDado.length) {
    await pessoa.ref.collection("privado").doc("contato").set(contato, { merge: true });
  }

  // 2. Só então remove da ficha.
  const remover = {};
  presentes.forEach((campo) => (remover[campo] = FieldValue.delete()));
  await pessoa.ref.update(remover);
}

console.log(`
  ${pessoas.size} pessoas · ${aMover} com dado movido · ${vazias} com campo vazio limpo · ${jaMovidas} já em ordem`);

if (aplicar) {
  // Confere que nenhuma ficha ficou com campo pessoal.
  const depois = await db.collection("people").get();
  const sobraram = depois.docs.filter((d) =>
    CAMPOS.some((c) => d.data()[c] !== undefined),
  );
  console.log(
    `\n  ${sobraram.length === 0 ? "nenhuma ficha tem mais campo pessoal" : sobraram.length + " ainda têm: " + sobraram.map((d) => d.data().nome).join(", ")}`,
  );
} else if (aMover + vazias > 0) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
}
process.exit(0);
