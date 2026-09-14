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
 * 3. `conferirConvite` e `resgatarConvite` — o convite liga a conta nova à
 *    ficha de uma pessoa, e deixar o cliente escrever esse vínculo seria
 *    deixá-lo escolher de quem quer ser. Estão em `convites.js`.
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

export { conferirConvite, resgatarConvite } from "./convites.js";

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
    if (!evento.data?.after?.exists) return;

    /*
     * Relê o documento em vez de usar o que veio no evento.
     *
     * Duas gravações seguidas em `users/{uid}` disparam duas execuções, e elas
     * não são entregues em ordem nem esperam uma pela outra. Com o valor do
     * evento, a execução atrasada escrevia o estado velho por cima do novo — e
     * a outra, que leu a claim certa, achava que não havia nada a fazer e
     * voltava. O resultado era o pior caso possível: documento com o vínculo
     * certo e token com o vínculo nulo, sem erro em lugar nenhum. A pessoa
     * entra no app, vê tudo, e só o envio da foto é recusado.
     *
     * Relendo, qualquer ordem converge para o que está gravado agora.
     */
    const documento = await getFirestore().collection("users").doc(uid).get();
    if (!documento.exists) return;
    const dados = documento.data();

    const desejado = {
      role: dados.role ?? "participante",
      personId: dados.personId ?? null,
    };

    const usuario = await getAuth().getUser(uid);
    const atual = usuario.customClaims ?? {};
    if (atual.role === desejado.role && (atual.personId ?? null) === desejado.personId) return;

    await getAuth().setCustomUserClaims(uid, { ...atual, ...desejado });
    logger.info("claims sincronizadas", { uid, ...desejado });
  },
);
