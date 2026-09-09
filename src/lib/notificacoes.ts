"use client";

/**
 * Registro do aparelho para receber avisos por push (Firebase Cloud Messaging).
 *
 * O envio é feito no servidor — ver `functions/avisos.js` — porque disparar
 * push exige credencial que não pode viver no cliente. Daqui só sai o token do
 * aparelho, guardado em `users/{uid}.tokensFcm`.
 */
import { getMessaging, getToken, isSupported } from "firebase/messaging";
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

/*
 * Não existe ouvinte de primeiro plano aqui, e é de propósito.
 *
 * O ouvinte do SDK (`onMessage`) serve para o caso em que o service worker do
 * Firebase engole a notificação quando a página está em foco, deixando a
 * exibição para a página. Este projeto usa um service worker próprio, com
 * `push` cru, que chama `showNotification` sempre — em foco ou não. Ligar o
 * ouvinte também faria o aviso aparecer duas vezes.
 */
