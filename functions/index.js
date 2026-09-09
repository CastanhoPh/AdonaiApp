/**
 * Cloud Functions do AdonaiApp.
 *
 * Duas coisas que o navegador não pode fazer:
 *
 * 1. `entregarAviso` — mandar push exige credencial de servidor, que não pode
 *    ficar no cliente. Antes a direção compunha o aviso na tela e alguém tinha
 *    de rodar `npm run avisos` no terminal para ele sair. Agora a criação do
 *    documento dispara a entrega.
 *
 * 2. `lembrarDosEnsaios` — ninguém está com o app aberto às sete da manhã para
 *    lembrar o elenco do ensaio de amanhã. Só um agendador do servidor resolve.
 *
 * Ambas com `maxInstances` baixo de propósito: é um grupo de teatro de uma
 * igreja, o volume é de dezenas de avisos por mês, e o teto evita que um erro
 * em laço vire fatura no plano Blaze.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { enviarAviso } from "./avisos.js";

initializeApp();

const REGIAO = "southamerica-east1"; // São Paulo: mais perto do elenco.
const COMUM = { region: REGIAO, maxInstances: 5, memory: "256MiB" };

/** Entrega o aviso assim que a direção o registra. */
export const entregarAviso = onDocumentCreated(
  { ...COMUM, document: "avisos/{avisoId}" },
  async (evento) => {
    const documento = evento.data;
    if (!documento) return;

    const aviso = documento.data();
    // Só o que nasce pendente: reenvio manual e correção não devem redisparar.
    if (aviso.status !== "pendente") return;

    const resultado = await enviarAviso(documento.ref, aviso);
    logger.info("aviso entregue", {
      avisoId: documento.id,
      alvo: aviso.alvo,
      entregues: resultado.entregues,
      aparelhos: resultado.tokens,
      erro: resultado.erro ?? null,
    });
  },
);

/** Data de amanhã em São Paulo, no formato que os ensaios usam (AAAA-MM-DD). */
function amanhaEmSaoPaulo() {
  const agora = new Date();
  const emSP = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  emSP.setDate(emSP.getDate() + 1);
  const mes = String(emSP.getMonth() + 1).padStart(2, "0");
  const dia = String(emSP.getDate()).padStart(2, "0");
  return `${emSP.getFullYear()}-${mes}-${dia}`;
}

/**
 * Lembra os convocados do ensaio de amanhã, uma vez por dia.
 *
 * Cria o aviso em vez de enviar direto: assim o lembrete aparece no histórico
 * da tela de Avisos como qualquer outro, e a entrega continua sendo
 * responsabilidade de uma única função. `lembreteEm` no ensaio é a trava contra
 * repetição — se o agendador rodar duas vezes, o segundo não manda nada.
 */
export const lembrarDosEnsaios = onSchedule(
  { ...COMUM, schedule: "30 7 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const db = getFirestore();
    const amanha = amanhaEmSaoPaulo();

    const ensaios = await db
      .collection("rehearsals")
      .where("data", "==", amanha)
      .where("status", "==", "agendado")
      .get();

    if (ensaios.empty) {
      logger.info("nenhum ensaio amanhã", { data: amanha });
      return;
    }

    for (const ensaio of ensaios.docs) {
      const dados = ensaio.data();
      if (dados.lembreteEm) {
        logger.info("lembrete já enviado", { ensaioId: ensaio.id });
        continue;
      }

      const hora = dados.horaInicio ? ` às ${dados.horaInicio}` : "";
      const local = dados.local ? ` em ${dados.local}` : "";
      await db.collection("avisos").add({
        titulo: "Não esqueça do ensaio!",
        mensagem: `Amanhã${hora}${local}. Confirme sua presença no app.`,
        alvo: "convocados",
        rehearsalId: ensaio.id,
        playId: dados.playId ?? "",
        criadoPor: "lembrete automático",
        criadoEm: new Date().toISOString(),
        status: "pendente",
        enviadoEm: "",
        detalhe: "",
        entregues: 0,
        automatico: true,
      });

      await ensaio.ref.update({ lembreteEm: new Date().toISOString() });
      logger.info("lembrete criado", { ensaioId: ensaio.id, data: amanha });
    }
  },
);

/**
 * Espelha `role` e `personId` da conta nas claims do token.
 *
 * As regras do Storage precisam saber quem é a pessoa para deixá-la trocar a
 * própria foto, e o caminho do arquivo usa `personId`. A alternativa era a
 * regra consultar o Firestore a cada envio — o que custa uma leitura por
 * requisição e depende de acesso entre serviços. Claim no token é resolvido
 * pelo próprio Firebase Auth, sem leitura nenhuma.
 *
 * Roda em qualquer escrita em `users/{uid}`, que é onde `role` e `personId`
 * mudam: promover alguém a administrador ou vincular a conta à pessoa
 * cadastrada. Compara antes de gravar, senão a própria gravação de claim
 * dispararia o gatilho de novo.
 */
export const sincronizarClaims = onDocumentWritten(
  { ...COMUM, document: "users/{uid}" },
  async (evento) => {
    const uid = evento.params.uid;
    const depois = evento.data?.after?.data();
    if (!depois) return;

    const desejado = {
      role: depois.role ?? "participante",
      personId: depois.personId ?? null,
    };

    const usuario = await getAuth().getUser(uid);
    const atual = usuario.customClaims ?? {};
    if (atual.role === desejado.role && (atual.personId ?? null) === desejado.personId) return;

    await getAuth().setCustomUserClaims(uid, { ...atual, ...desejado });
    logger.info("claims sincronizadas", { uid, ...desejado });
  },
);
