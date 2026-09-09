/**
 * Lógica comum de criação de contas do AdonaiApp, usada por `admin.mjs` e
 * `participante.mjs`.
 *
 * Deixa três coisas consistentes de uma vez:
 *   1. a conta no Authentication;
 *   2. o cadastro em `people` (é ele que a direção enxerga na tela Pessoas);
 *   3. o documento `users/{uid}` com o papel e o vínculo entre os dois.
 *
 * A senha pode vir da variável de ambiente ADONAI_SENHA — assim ela não
 * aparece na lista de processos do sistema nem no histórico do terminal. Sem
 * ela, entra uma senha aleatória descartada e o script imprime um link de uso
 * único para a pessoa definir a própria senha. A senha nunca é exibida nem
 * gravada em arquivo.
 */
import { randomBytes } from "node:crypto";
import { auth, db, encerrarCom, PROJECT_ID } from "./firebase-admin-app.mjs";

const PAPEIS = { admin: "administrador", participante: "participante" };

export async function provisionarConta({ role }) {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const nomeInformado = (process.argv[3] ?? "").trim();

  if (!email || !email.includes("@")) {
    encerrarCom(`Informe o e-mail: npm run ${role} -- pessoa@exemplo.com "Nome Completo"`);
  }

  const senhaEscolhida = process.env.ADONAI_SENHA || null;
  if (senhaEscolhida && senhaEscolhida.length < 6) {
    encerrarCom("A senha precisa ter pelo menos 6 caracteres.");
  }

  // ------------------------------------------------------ Authentication
  let usuario = null;
  try {
    usuario = await auth.getUserByEmail(email);
  } catch (erro) {
    if (erro?.code !== "auth/user-not-found") {
      encerrarCom(`Falha ao consultar o usuário: ${erro?.message ?? erro}`);
    }
  }

  let linkDeSenha = null;

  if (!usuario) {
    usuario = await auth.createUser({
      email,
      password: senhaEscolhida ?? randomBytes(24).toString("base64url"),
      displayName: nomeInformado || undefined,
      emailVerified: false,
    });
    console.log(`  Conta criada no Authentication (uid ${usuario.uid})`);

    if (!senhaEscolhida) {
      try {
        linkDeSenha = await auth.generatePasswordResetLink(email);
      } catch (erro) {
        console.warn(`  Não foi possível gerar o link de senha: ${erro?.message ?? erro}`);
        console.warn('  Use "Esqueci minha senha" na tela de login do aplicativo.');
      }
    }
  } else {
    console.log(`  Conta já existia no Authentication (uid ${usuario.uid})`);
    if (senhaEscolhida) {
      await auth.updateUser(usuario.uid, { password: senhaEscolhida });
      console.log("  Senha redefinida.");
    }
    if (nomeInformado && usuario.displayName !== nomeInformado) {
      await auth.updateUser(usuario.uid, { displayName: nomeInformado });
    }
  }

  const nome = nomeInformado || usuario.displayName || email.split("@")[0];

  // --------------------------------------------------------------- people
  const pessoas = await db.collection("people").where("email", "==", email).limit(1).get();
  let personId = pessoas.empty ? null : pessoas.docs[0].id;

  if (!personId) {
    const referencia = db.collection("people").doc();
    await referencia.set({
      nome,
      email,
      telefone: "",
      fotoUrl: "",
      ativo: true,
      caracteristicas: [],
      criadoEm: new Date().toISOString(),
    });
    personId = referencia.id;
    console.log(`  Cadastro criado em people/${personId}`);
  } else {
    console.log(`  Cadastro já existia em people/${personId}`);
    if (nomeInformado) await db.collection("people").doc(personId).update({ nome: nomeInformado });
  }

  // ---------------------------------------------------------------- users
  await db.collection("users").doc(usuario.uid).set(
    { nome, email, role, personId, criadoEm: new Date().toISOString() },
    { merge: true },
  );

  console.log(`\n  ${email} está configurado como ${PAPEIS[role]} (${PROJECT_ID}).`);

  if (linkDeSenha) {
    console.log("\n  Abra este link para definir a senha (uso único):");
    console.log(`  ${linkDeSenha}`);
  }

  if (!nomeInformado) {
    console.log(`  Nome provisório "${nome}" — ajuste na tela Pessoas do aplicativo.`);
  }

  console.log("");
  process.exit(0);
}
