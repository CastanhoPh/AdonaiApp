"use client";

/**
 * Registro do aparelho para receber avisos por push (Firebase Cloud Messaging).
 *
 * O envio é feito fora do navegador — ver `scripts/enviar-avisos.mjs` — porque
 * disparar push exige credencial de servidor, que não pode viver no cliente.
 * Daqui só sai o token do aparelho, guardado em `users/{uid}.tokensFcm`.
 */
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import app from "./firebase";
import { salvarTokenFcm } from "./db";

/**
 * Chave pública do Web Push do projeto (Configurações do projeto > Cloud
 * Messaging > Certificados push da Web). Sem ela o FCM não emite token.
 */
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const pushConfigurado = Boolean(VAPID);

export type ResultadoRegistro =
  | "registrado"
  | "sem-vapid"
  | "sem-suporte"
  | "sem-permissao"
  | "erro";

/**
 * Pega o token deste aparelho e guarda na conta. Precisa da permissão de
 * notificação já concedida e do service worker registrado.
 */
export async function registrarAparelho(uid: string): Promise<ResultadoRegistro> {
  if (!VAPID) return "sem-vapid";
  if (typeof window === "undefined") return "sem-suporte";
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return "sem-permissao";
  }

  try {
    if (!(await isSupported())) return "sem-suporte";

    // O mesmo service worker que torna o app instalável também recebe o push.
    const registro = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID,
      serviceWorkerRegistration: registro,
    });
    if (!token) return "erro";

    await salvarTokenFcm(uid, token);
    return "registrado";
  } catch (erro) {
    console.error("Falha ao registrar o aparelho para avisos:", erro);
    return "erro";
  }
}

/**
 * Mostra o aviso quando ele chega com o app aberto — nesse caso o navegador
 * entrega a mensagem à página em vez de exibir a notificação sozinho.
 */
export function ouvirAvisosEmPrimeiroPlano(
  aoReceber: (titulo: string, mensagem: string) => void,
): () => void {
  if (typeof window === "undefined" || !VAPID) return () => {};
  try {
    return onMessage(getMessaging(app), (payload) => {
      const titulo = payload.notification?.title ?? payload.data?.titulo ?? "AdonaiApp";
      const mensagem = payload.notification?.body ?? payload.data?.mensagem ?? "";
      aoReceber(titulo, mensagem);
    });
  } catch (erro) {
    console.error("Falha ao ouvir avisos:", erro);
    return () => {};
  }
}
