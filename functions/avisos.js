/**
 * Resolução de destinatários e envio pelo Firebase Cloud Messaging.
 *
 * É a mesma lógica de `scripts/enviar-avisos.mjs`, que continua existindo como
 * saída manual (`npm run avisos`) para reenviar algo à mão ou depurar sem
 * publicar função. As duas compartilham o formato do documento em `avisos/{id}`
 * e o mesmo tratamento de token inválido.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

/** Ids de pessoa que devem receber, conforme o alvo do aviso. */
export async function resolverPessoas(aviso) {
  const db = getFirestore();

  if (aviso.alvo === "todos") {
    const snap = await db.collection("people").where("ativo", "==", true).get();
    return snap.docs.map((d) => d.id);
  }

  if (aviso.alvo === "elenco") {
    if (!aviso.playId) return [];
    const snap = await db.collection("plays").doc(aviso.playId).collection("characters").get();
    return snap.docs.map((d) => d.data().personId).filter(Boolean);
  }

  // Convocados de um ensaio.
  if (!aviso.rehearsalId) return [];
  const ensaio = await db.collection("rehearsals").doc(aviso.rehearsalId).get();
  if (!ensaio.exists) return [];
  const dados = ensaio.data();

  if (!dados.todos) return dados.convocados ?? [];

  // "Todo o elenco convocado": os escalados na peça do ensaio.
  const personagens = await db
    .collection("plays")
    .doc(dados.playId)
    .collection("characters")
    .get();
  return personagens.docs.map((d) => d.data().personId).filter(Boolean);
}

/** Tokens de push das contas ligadas a essas pessoas. */
export async function tokensDasPessoas(personIds) {
  if (personIds.length === 0) return { tokens: [], donos: new Map() };

  const db = getFirestore();
  const unicos = [...new Set(personIds)];
  const tokens = [];
  const donos = new Map(); // token → uid, para limpar os inválidos depois

  // `in` aceita no máximo 30 valores por consulta.
  for (let i = 0; i < unicos.length; i += 30) {
    const fatia = unicos.slice(i, i + 30);
    const snap = await db.collection("users").where("personId", "in", fatia).get();
    snap.docs.forEach((d) => {
      (d.data().tokensFcm ?? []).forEach((token) => {
        if (!donos.has(token)) {
          tokens.push(token);
          donos.set(token, d.id);
        }
      });
    });
  }

  return { tokens, donos };
}

/**
 * Remove das contas os tokens que o FCM recusou por não existirem mais.
 *
 * Sem isso a lista só cresce: cada navegador reinstalado deixa um token morto
 * que faz toda entrega futura contar uma falha.
 */
async function limparTokens(invalidos, donos) {
  const db = getFirestore();
  const porUid = new Map();
  invalidos.forEach((token) => {
    const uid = donos.get(token);
    if (uid) porUid.set(uid, [...(porUid.get(uid) ?? []), token]);
  });

  await Promise.all(
    [...porUid].map(([uid, tokens]) =>
      db
        .collection("users")
        .doc(uid)
        .update({ tokensFcm: FieldValue.arrayRemove(...tokens) }),
    ),
  );
  return porUid.size;
}

const CODIGOS_DE_TOKEN_MORTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Envia um aviso e grava o resultado no próprio documento.
 *
 * Nunca lança: o resultado, inclusive a falha, fica registrado em `status` e
 * `detalhe` para a direção ler na tela. Uma função que estoura seria repetida
 * pela infraestrutura e mandaria a notificação duas vezes.
 */
export async function enviarAviso(ref, aviso) {
  const agora = () => new Date().toISOString();

  try {
    const pessoas = await resolverPessoas(aviso);
    const { tokens, donos } = await tokensDasPessoas(pessoas);

    if (tokens.length === 0) {
      await ref.update({
        status: "erro",
        enviadoEm: agora(),
        entregues: 0,
        detalhe:
          "Ninguém do alvo autorizou avisos neste momento. Peça para o elenco permitir as notificações no Perfil.",
      });
      return { entregues: 0, tokens: 0 };
    }

    const destino = aviso.rehearsalId ? "/ensaios" : "/inicio";
    const resposta = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: aviso.titulo, body: aviso.mensagem },
      data: { avisoId: ref.id, ensaioId: aviso.rehearsalId ?? "", url: destino },
      webpush: {
        fcmOptions: { link: destino },
        notification: { icon: "/adonai-icon-192.png" },
      },
    });

    const invalidos = resposta.responses
      .map((r, i) => (CODIGOS_DE_TOKEN_MORTO.has(r.error?.code ?? "") ? tokens[i] : null))
      .filter(Boolean);
    if (invalidos.length > 0) await limparTokens(invalidos, donos);

    await ref.update({
      status: resposta.successCount > 0 ? "enviado" : "erro",
      enviadoEm: agora(),
      entregues: resposta.successCount,
      detalhe:
        resposta.successCount > 0
          ? `Entregue em ${resposta.successCount} de ${tokens.length} aparelho(s).`
          : (resposta.responses.find((r) => r.error)?.error?.message ??
            "Nenhum aparelho aceitou o aviso."),
    });

    return { entregues: resposta.successCount, tokens: tokens.length };
  } catch (erro) {
    await ref.update({
      status: "erro",
      enviadoEm: agora(),
      detalhe: String(erro?.message ?? erro),
    });
    return { entregues: 0, tokens: 0, erro: String(erro?.message ?? erro) };
  }
}
