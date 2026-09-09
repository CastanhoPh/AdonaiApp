/**
 * Resgate de convite de primeiro acesso.
 *
 * Por que isto é servidor e não navegador: o convite liga uma conta nova à
 * ficha de uma pessoa, e é justamente esse vínculo que carrega o histórico, os
 * personagens e a convocação dela. Se o cliente pudesse escrever
 * `users/{uid}.personId`, qualquer um escolheria de quem quer ser — e nenhuma
 * regra do Firestore consegue conferir "esta pessoa apresentou um código
 * válido", porque conferir o código exige ler um documento que quem ainda não
 * tem conta não pode ler.
 *
 * Com a função no meio, a coleção `convites` fica fechada para todo mundo
 * menos a direção, e o código nunca é exposto a uma consulta.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const TAMANHO_DO_CODIGO = 8;

/** Igual ao `normalizarCodigo` do cliente: maiúsculas, sem separador. */
function normalizarCodigo(texto) {
  return String(texto ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TAMANHO_DO_CODIGO);
}

/**
 * Lê o convite e diz por que ele não serve, se não servir.
 *
 * As recusas têm mensagens diferentes de propósito: "não encontrado", "já
 * usado" e "venceu" levam a ações distintas de quem está com o papel na mão, e
 * juntar tudo em "código inválido" faria a pessoa digitar de novo um código
 * que está certo.
 */
async function lerConvite(db, codigo) {
  if (codigo.length !== TAMANHO_DO_CODIGO) {
    throw new HttpsError("invalid-argument", "O código tem 8 caracteres.");
  }

  const ref = db.collection("convites").doc(codigo);
  const documento = await ref.get();
  if (!documento.exists) {
    throw new HttpsError("not-found", "Não encontramos este código. Confira com a direção.");
  }

  const convite = documento.data();
  if (convite.usadoEm) {
    throw new HttpsError(
      "failed-precondition",
      "Este código já foi usado. Peça um novo para a direção.",
    );
  }
  if (convite.expiraEm && convite.expiraEm < new Date().toISOString()) {
    throw new HttpsError("failed-precondition", "Este código venceu. Peça um novo para a direção.");
  }

  const pessoa = await db.collection("people").doc(convite.personId).get();
  if (!pessoa.exists) {
    throw new HttpsError("not-found", "A ficha deste convite não existe mais.");
  }

  const jaTemConta = await db
    .collection("users")
    .where("personId", "==", convite.personId)
    .limit(1)
    .get();
  if (!jaTemConta.empty) {
    throw new HttpsError("failed-precondition", "Esta pessoa já tem acesso ao aplicativo.");
  }

  return { ref, convite, pessoa };
}

const COMUM = { region: "southamerica-east1", maxInstances: 5, memory: "256MiB" };

/**
 * Diz de quem é o convite, para a pessoa confirmar antes de criar a conta.
 *
 * Aberta a quem não tem conta — é o único jeito, já que quem resgata está
 * criando a conta agora. Revela apenas o nome, e só a quem já tem o código em
 * mãos: adivinhar são 25^8 combinações, e o teto de instâncias limita o ritmo
 * de quem tentar.
 */
export const conferirConvite = onCall(COMUM, async (requisicao) => {
  const db = getFirestore();
  const codigo = normalizarCodigo(requisicao.data?.codigo);
  const { pessoa } = await lerConvite(db, codigo);
  return { nome: pessoa.data().nome ?? "", email: pessoa.data().email ?? "" };
});

/**
 * Cria a conta, liga à ficha e queima o código.
 *
 * A conta do Auth nasce antes da transação porque criar usuário não entra em
 * transação do Firestore. Se a transação falhar depois — outra pessoa resgatou
 * o mesmo código no mesmo instante, por exemplo — a conta recém-criada é
 * apagada, senão sobraria um login órfão que entra no app e não vê nada.
 */
export const resgatarConvite = onCall(COMUM, async (requisicao) => {
  const db = getFirestore();
  const dados = requisicao.data ?? {};
  const codigo = normalizarCodigo(dados.codigo);
  const nome = String(dados.nome ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const email = String(dados.email ?? "")
    .trim()
    .toLowerCase();
  const senha = String(dados.senha ?? "");

  if (nome.length < 3) throw new HttpsError("invalid-argument", "Escreva seu nome completo.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Confira o e-mail.");
  }
  if (senha.length < 6) {
    throw new HttpsError("invalid-argument", "A senha precisa ter pelo menos 6 caracteres.");
  }

  const { ref, convite, pessoa } = await lerConvite(db, codigo);

  /*
   * As cópias do nome são lidas antes da transação e escritas dentro dela.
   * `characters.personNome` alimenta a tela de elenco sem ler a ficha de cada
   * um; deixá-la com o nome antigo faria a pessoa não se achar na peça em que
   * atuou. Ler fora da transação é seguro aqui: quem mexe nesses documentos é
   * a direção, e a janela é de milissegundos.
   */
  const copiasDoNome = [];
  if (nome !== pessoa.data().nome) {
    const pecas = await db.collection("plays").get();
    for (const peca of pecas.docs) {
      const papeis = await peca.ref
        .collection("characters")
        .where("personId", "==", convite.personId)
        .get();
      papeis.docs.forEach((papel) => copiasDoNome.push(papel.ref));
    }
  }

  let usuario;
  try {
    usuario = await getAuth().createUser({ email, password: senha, displayName: nome });
  } catch (erro) {
    if (erro.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Já existe uma conta com este e-mail. Entre com ele ou use outro.",
      );
    }
    if (erro.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "A senha precisa ter pelo menos 6 caracteres.");
    }
    logger.error("falha ao criar a conta do convite", { codigo, erro: String(erro) });
    throw new HttpsError("internal", "Não foi possível criar a conta. Tente de novo.");
  }

  const agora = new Date().toISOString();
  try {
    await db.runTransaction(async (transacao) => {
      // Reconfere aqui dentro: entre a leitura e agora, outra pessoa pode ter
      // resgatado o mesmo código.
      const atual = await transacao.get(ref);
      if (!atual.exists || atual.data().usadoEm) {
        throw new HttpsError("failed-precondition", "Este código acabou de ser usado.");
      }

      transacao.set(db.collection("users").doc(usuario.uid), {
        uid: usuario.uid,
        nome,
        email,
        // O convite nunca promove: administrador sai do script `npm run admin`.
        role: "participante",
        personId: convite.personId,
        criadoEm: agora,
      });

      transacao.update(pessoa.ref, {
        nome,
        email,
        /*
         * Ativa. É o inverso da regra que deixa inativa quem não tem acesso:
         * sem isto a pessoa entraria no app e continuaria fora da convocação
         * de ensaio e do alvo "todos" dos avisos.
         */
        ativo: true,
      });

      copiasDoNome.forEach((copia) => transacao.update(copia, { personNome: nome }));
      transacao.update(ref, { usadoEm: agora, usadoPor: usuario.uid });
    });
  } catch (erro) {
    // Sem os documentos o login não serve para nada: desfaz a conta.
    await getAuth()
      .deleteUser(usuario.uid)
      .catch((falha) =>
        logger.error("conta órfã do convite", { uid: usuario.uid, falha: String(falha) }),
      );
    if (erro instanceof HttpsError) throw erro;
    logger.error("falha ao resgatar o convite", { codigo, erro: String(erro) });
    throw new HttpsError("internal", "Não foi possível concluir o acesso. Tente de novo.");
  }

  /*
   * Claims na hora, sem esperar `sincronizarClaims`.
   *
   * Aquele gatilho roda na escrita de `users/{uid}` e resolveria isto sozinho,
   * mas leva alguns segundos — e a pessoa entra no app no segundo seguinte. Sem
   * a claim no primeiro token, o envio da foto de perfil seria negado logo na
   * tela de boas-vindas.
   */
  await getAuth().setCustomUserClaims(usuario.uid, {
    role: "participante",
    personId: convite.personId,
  });

  logger.info("convite resgatado", {
    codigo,
    uid: usuario.uid,
    personId: convite.personId,
    copiasDoNome: copiasDoNome.length,
  });
  return { ok: true, email };
});
