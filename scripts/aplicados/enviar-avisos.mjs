/**
 * Disparador dos avisos do AdonaiApp.
 *
 *   npm run avisos
 *
 * A direção compõe o aviso na tela `/admin/avisos`, que o grava em
 * `avisos/{id}` com status `pendente`. Este script lê os pendentes, resolve
 * quem deve receber, envia pelo Firebase Cloud Messaging e marca o resultado.
 *
 * Por que fora do navegador: enviar push exige credencial de servidor (a conta
 * de serviço), que não pode ficar no cliente. Se o projeto for para o plano
 * Blaze, a mesma lógica cabe numa Cloud Function disparada na criação do
 * documento — daí o envio deixa de ser manual.
 *
 * Sem argumentos, envia todos os pendentes. Com `--dry`, apenas mostra quem
 * receberia, sem enviar nada.
 */
import { getMessaging } from "firebase-admin/messaging";
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "entregava os avisos pendentes — hoje quem entrega é a Cloud Function `entregarAviso`, que dispara sozinha na criação do aviso");

const seco = process.argv.includes("--dry");

/** Ids de pessoa que devem receber, conforme o alvo do aviso. */
async function resolverPessoas(aviso) {
  if (aviso.alvo === "todos") {
    const snap = await db.collection("people").where("ativo", "==", true).get();
    return snap.docs.map((d) => d.id);
  }

  if (aviso.alvo === "elenco") {
    if (!aviso.playId) return [];
    const snap = await db.collection("plays").doc(aviso.playId).collection("characters").get();
    return snap.docs.map((d) => d.data().personId).filter(Boolean);
  }

  // convocados de um ensaio
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
async function tokensDasPessoas(personIds) {
  if (personIds.length === 0) return { tokens: [], donos: new Map() };

  const unicos = [...new Set(personIds)];
  const tokens = [];
  const donos = new Map(); // token -> uid, para limpar os inválidos depois

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

/** Remove da conta os tokens que o FCM recusou por não existirem mais. */
async function limparTokens(invalidos, donos) {
  const porUid = new Map();
  invalidos.forEach((token) => {
    const uid = donos.get(token);
    if (!uid) return;
    porUid.set(uid, [...(porUid.get(uid) ?? []), token]);
  });

  for (const [uid, tokens] of porUid) {
    const ref = db.collection("users").doc(uid);
    const atual = (await ref.get()).data()?.tokensFcm ?? [];
    await ref.update({ tokensFcm: atual.filter((t) => !tokens.includes(t)) });
    console.log(`    token inválido removido de users/${uid} (${tokens.length})`);
  }
}

const pendentes = await db.collection("avisos").where("status", "==", "pendente").get();

if (pendentes.empty) {
  console.log("\n  Nenhum aviso pendente.\n");
  process.exit(0);
}

console.log(`\n  ${pendentes.size} aviso(s) pendente(s)${seco ? " — modo simulação" : ""}\n`);

for (const documento of pendentes.docs) {
  const aviso = documento.data();
  console.log(`  › "${aviso.titulo}" (alvo: ${aviso.alvo})`);

  try {
    const pessoas = await resolverPessoas(aviso);
    const { tokens, donos } = await tokensDasPessoas(pessoas);
    console.log(`    ${pessoas.length} pessoa(s), ${tokens.length} aparelho(s) autorizados`);

    if (seco) continue;

    if (tokens.length === 0) {
      await documento.ref.update({
        status: "erro",
        enviadoEm: new Date().toISOString(),
        detalhe:
          "Ninguém do alvo autorizou avisos neste momento. Peça para o elenco permitir as notificações no Perfil.",
        entregues: 0,
      });
      console.log("    nada enviado: nenhum aparelho autorizado\n");
      continue;
    }

    const resposta = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: aviso.titulo, body: aviso.mensagem },
      data: {
        avisoId: documento.id,
        ensaioId: aviso.rehearsalId ?? "",
        url: aviso.rehearsalId ? "/ensaios" : "/inicio",
      },
      webpush: {
        fcmOptions: { link: aviso.rehearsalId ? "/ensaios" : "/inicio" },
        notification: { icon: "/adonai-icon-192.png" },
      },
    });

    const invalidos = [];
    resposta.responses.forEach((r, i) => {
      const codigo = r.error?.code ?? "";
      if (
        codigo === "messaging/registration-token-not-registered" ||
        codigo === "messaging/invalid-registration-token"
      ) {
        invalidos.push(tokens[i]);
      }
    });
    if (invalidos.length > 0) await limparTokens(invalidos, donos);

    await documento.ref.update({
      status: resposta.successCount > 0 ? "enviado" : "erro",
      enviadoEm: new Date().toISOString(),
      entregues: resposta.successCount,
      detalhe:
        resposta.successCount > 0
          ? `Entregue em ${resposta.successCount} de ${tokens.length} aparelho(s).`
          : (resposta.responses.find((r) => r.error)?.error?.message ??
            "Nenhum aparelho aceitou o aviso."),
    });

    console.log(
      `    entregue em ${resposta.successCount}/${tokens.length}${
        resposta.failureCount > 0 ? ` (${resposta.failureCount} falha[s])` : ""
      }\n`,
    );
  } catch (erro) {
    console.error(`    falhou: ${erro?.message ?? erro}\n`);
    if (!seco) {
      await documento.ref.update({
        status: "erro",
        enviadoEm: new Date().toISOString(),
        detalhe: String(erro?.message ?? erro),
      });
    }
  }
}

console.log("  Fim.\n");
process.exit(0);
