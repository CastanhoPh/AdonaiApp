#!/usr/bin/env node
/**
 * Copia o nome do cadastro para a conta de acesso.
 *
 * `users/{uid}.nome` nasce do prefixo do e-mail quando a conta é criada antes
 * de a direção cadastrar a pessoa — daí "celinemocarzelm" no lugar de um nome.
 * A interface mostra `pessoa.nome` primeiro e só cai na conta como reserva, mas
 * a reserva aparece em conta sem vínculo, e o displayName do Auth (usado em
 * e-mail de redefinição de senha) fica com o prefixo para sempre.
 *
 *   node scripts/alinhar-nomes.mjs            confere
 *   node scripts/alinhar-nomes.mjs --aplicar  grava
 */
import { auth, db } from "./firebase-admin-app.mjs";

const aplicar = process.argv.includes("--aplicar");
const ehPlaceholder = (nome, email) => !nome || nome === String(email).split("@")[0];

const contas = await db.collection("users").get();
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

let mudancas = 0;
for (const conta of contas.docs) {
  const v = conta.data();
  const pessoa = v.personId ? (await db.collection("people").doc(v.personId).get()).data() : null;
  const doCadastro = pessoa?.nome;

  if (!ehPlaceholder(v.nome, v.email)) {
    console.log(`  ${String(v.email).padEnd(32)} "${v.nome}" já é um nome`);
    continue;
  }
  if (!doCadastro || ehPlaceholder(doCadastro, v.email)) {
    console.log(`  ${String(v.email).padEnd(32)} ⚠ o cadastro também está sem nome real ("${doCadastro ?? "—"}") — precisa ser digitado`);
    continue;
  }

  mudancas++;
  console.log(`  ${String(v.email).padEnd(32)} "${v.nome}" → "${doCadastro}"`);
  if (!aplicar) continue;
  await conta.ref.update({ nome: doCadastro });
  // O displayName aparece nos e-mails que o Firebase Auth envia.
  await auth.updateUser(conta.id, { displayName: doCadastro }).catch((e) => {
    console.error(`      displayName falhou: ${e?.message ?? e}`);
  });
}

console.log(`\n${mudancas} conta(s) ${aplicar ? "atualizada(s)" : "a atualizar"}.`);
if (!aplicar && mudancas > 0) console.log("Rode de novo com --aplicar.\n");
process.exit(0);
