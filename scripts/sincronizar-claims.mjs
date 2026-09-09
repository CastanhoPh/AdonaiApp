#!/usr/bin/env node
/**
 * Preenche as claims `role` e `personId` das contas que já existem.
 *
 * A função `sincronizarClaims` cuida das mudanças daqui para frente, mas quem
 * já estava cadastrado antes dela nunca disparou o gatilho. Este script faz o
 * primeiro preenchimento; depois dele, não precisa rodar de novo.
 *
 * O token do navegador só enxerga a claim nova depois de ser renovado — o app
 * força a renovação quando percebe a diferença, e o pior caso é a próxima
 * abertura.
 */
import { auth, db } from "./firebase-admin-app.mjs";

const contas = await db.collection("users").get();
console.log(`\n${contas.size} conta(s)\n`);

for (const documento of contas.docs) {
  const { role = "participante", personId = null, email } = documento.data();
  try {
    const usuario = await auth.getUser(documento.id);
    const atual = usuario.customClaims ?? {};
    if (atual.role === role && (atual.personId ?? null) === personId) {
      console.log(`  ${String(email).padEnd(32)} já estava certo`);
      continue;
    }
    await auth.setCustomUserClaims(documento.id, { ...atual, role, personId });
    console.log(`  ${String(email).padEnd(32)} role=${role} personId=${personId}`);
  } catch (erro) {
    console.error(`  ${String(email).padEnd(32)} falhou: ${erro?.message ?? erro}`);
  }
}
console.log("\nPronto. Quem estiver com o app aberto precisa renovar o token — o app faz isso sozinho.\n");
process.exit(0);
