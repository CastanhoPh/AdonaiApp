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
import { createHash } from "node:crypto";
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

/*
 * Quantas tentativas cada origem tem, e em quanto tempo.
 *
 * Estas duas funções são as únicas do app abertas a quem não tem conta, e a
 * primeira responde se um código existe — o que é um oráculo para quem quiser
 * varrer. Adivinhar são 25^8 combinações e o convite vence em 7 dias, então
 * força bruta já era cara; o teto torna a varredura inviável em vez de apenas
 * cara, e protege a fatura, que é o recurso que de fato acaba.
 *
 * Os números são folgados para gente de verdade: quem digita errado tenta duas
 * ou três vezes, não trinta.
 */
const LIMITES = {
  conferir: { tentativas: 30, janelaMs: 10 * 60 * 1000 },
  resgatar: { tentativas: 10, janelaMs: 60 * 60 * 1000 },
};

/**
 * De onde veio a chamada, como identificador curto e sem o endereço em claro.
 *
 * Guardar IP de visitante é guardar dado pessoal de quem nem conta tem; o
 * resumo serve igual para contar tentativas e não serve para nada além disso.
 * Sem IP (chamada interna, teste), cai numa chave comum — pior é não limitar.
 */
function origem(requisicao) {
  const ip = requisicao.rawRequest?.ip ?? "";
  if (!ip) return "sem-origem";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Conta a tentativa e diz se ela cabe na janela.
 *
 * Transação porque duas chamadas simultâneas da mesma origem leriam o mesmo
 * número e gravariam o mesmo incremento — que é justamente o que alguém
 * tentando varrer faria.
 *
 * A janela é fixa, não deslizante: passados os minutos, a contagem recomeça do
 * zero. Deslizante seria mais justo e exigiria guardar cada tentativa; para
 * conter varredura, o balde simples basta.
 */
async function cabeMaisUma(db, chave, { tentativas, janelaMs }) {
  const ref = db.collection("limites").doc(chave);
  const agora = Date.now();
  return db.runTransaction(async (transacao) => {
    const atual = (await transacao.get(ref)).data();
    const mesmaJanela = atual && agora - atual.desde < janelaMs;
    const desde = mesmaJanela ? atual.desde : agora;
    const contagem = (mesmaJanela ? atual.contagem : 0) + 1;
    transacao.set(ref, {
      desde,
      contagem,
      // Para uma política de TTL do Firestore varrer isto sozinha.
      expiraEm: new Date(desde + janelaMs),
    });
    return contagem <= tentativas;
  });
}

/** Aplica o limite ou recusa. A mensagem não diz qual é o teto, de propósito. */
async function conterAbuso(db, requisicao, qual) {
  const chave = `${qual}-${origem(requisicao)}`;
  if (await cabeMaisUma(db, chave, LIMITES[qual])) return;
  logger.warn("limite de tentativas atingido", { qual, chave });
  throw new HttpsError(
    "resource-exhausted",
    "Muitas tentativas. Espere alguns minutos e tente de novo.",
  );
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
  await conterAbuso(db, requisicao, "conferir");
  const codigo = normalizarCodigo(requisicao.data?.codigo);
  const { pessoa } = await lerConvite(db, codigo);
  // Só o nome. O e-mail também vinha aqui, sem ninguém usar, e entregava o
  // endereço de alguém a qualquer um com o código na mão.
  return { nome: pessoa.data().nome ?? "" };
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
  await conterAbuso(db, requisicao, "resgatar");
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
        /*
         * Ativa. É o inverso da regra que deixa inativa quem não tem acesso:
         * sem isto a pessoa entraria no app e continuaria fora da convocação
         * de ensaio e do alvo "todos" dos avisos.
         */
        ativo: true,
      });

      /*
       * O e-mail vai para o contato privado, não para a ficha.
       *
       * `people` é lido por todo o elenco. Gravar o endereço ali recolocaria
       * em público exatamente o que foi tirado de lá — e por uma função, que é
       * onde ninguém olharia procurando o vazamento.
       */
      transacao.set(
        pessoa.ref.collection("privado").doc("contato"),
        { email },
        { merge: true },
      );

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
