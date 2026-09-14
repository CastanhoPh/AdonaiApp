/**
 * Entrar como alguém, para os testes, sem a senha de ninguém.
 *
 * O Admin SDK emite um token personalizado para um uid, o REST troca esse
 * token por uma sessão de verdade, e a sessão serve tanto para falar com o
 * Firestore por HTTP quanto para plantar no navegador.
 *
 * **Isto substituiu arquivos de sessão em disco.** A versão anterior guardava
 * `.s-admin.json` e `.s-part.json` com tokens vivos ao lado do código — e eles
 * acabaram indo parar num commit público, o que obrigou a revogar as sessões
 * das duas contas envolvidas. Token emitido na hora e jogado fora no fim não
 * tem como vazar por descuido.
 *
 * A trava do `garantirQueExiste` não é zelo: `signInWithCustomToken` com um uid
 * que não existe **cria** a conta, sem e-mail e sem provedor. Um erro de uma
 * linha (usar `personId` onde ia `uid`) já criou uma dessas em produção.
 */
import { auth, db } from "../firebase-admin-app.mjs";
import { lerEnv } from "./ambiente.mjs";

const env = lerEnv();
const CHAVE = env.NEXT_PUBLIC_FIREBASE_API_KEY;

/**
 * A conta de cada papel, pelo id do documento.
 *
 * O id do documento em `users` **é** o uid — o campo `uid` existe em algumas
 * contas e falta em outras, resquício de como cada uma foi criada. Ler o campo
 * é o erro que cria conta fantasma.
 */
export async function contaDoPapel(papel) {
  const contas = (await db.collection("users").get()).docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((c) => (c.role ?? "participante") === papel);
  if (contas.length === 0) {
    throw new Error(`Nenhuma conta com papel "${papel}" — não dá para testar essa visão.`);
  }
  // A mais antiga, para a suíte rodar sempre sobre a mesma conta.
  return contas.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))[0];
}

async function garantirQueExiste(uid) {
  try {
    await auth.getUser(uid);
  } catch {
    throw new Error(
      `Não existe conta com uid ${uid} no Authentication.\n` +
        `      Entrar com um uid inexistente criaria a conta — abortado de propósito.`,
    );
  }
}

/** Sessão viva de um uid: o token para as chamadas e o objeto que o SDK guarda. */
export async function entrarComo(uid) {
  await garantirQueExiste(uid);

  const personalizado = await auth.createCustomToken(uid);
  const sessao = await chamar("accounts:signInWithCustomToken", {
    token: personalizado,
    returnSecureToken: true,
  });
  if (!sessao.idToken) {
    throw new Error(`Não consegui a sessão de ${uid}: ${JSON.stringify(sessao)}`);
  }

  const { users } = await chamar("accounts:lookup", { idToken: sessao.idToken });
  const perfil = users[0];

  return {
    uid,
    email: perfil.email ?? null,
    idToken: sessao.idToken,
    /*
     * O formato exato que o SDK do Firebase guarda no IndexedDB. Plantar isto
     * antes de a página carregar é o que faz o navegador abrir já conectado,
     * sem passar pela tela de login a cada teste.
     */
    paraONavegador: {
      uid: perfil.localId,
      email: perfil.email,
      emailVerified: Boolean(perfil.emailVerified),
      isAnonymous: false,
      providerData: [
        {
          providerId: "password",
          uid: perfil.email,
          email: perfil.email,
          displayName: perfil.displayName ?? null,
          photoURL: null,
          phoneNumber: null,
        },
      ],
      stsTokenManager: {
        refreshToken: sessao.refreshToken,
        accessToken: sessao.idToken,
        expirationTime: Date.now() + Number(sessao.expiresIn) * 1000,
      },
      createdAt: perfil.createdAt,
      lastLoginAt: perfil.lastLoginAt,
      apiKey: CHAVE,
      appName: "[DEFAULT]",
    },
  };
}

async function chamar(metodo, corpo) {
  const resposta = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${metodo}?key=${CHAVE}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    },
  );
  return resposta.json();
}
