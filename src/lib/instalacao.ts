"use client";

/**
 * Instalação do app na tela de início.
 *
 * O evento `beforeinstallprompt` é disparado pelo navegador logo no
 * carregamento, muito antes de o tutorial montar. Por isso a escuta é
 * registrada na carga do módulo e o evento fica guardado aqui, com uma
 * assinatura para os componentes reagirem via `useSyncExternalStore`.
 */

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let guardado: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    // Sem o preventDefault o Chrome mostra a barra dele e descarta o evento.
    evento.preventDefault();
    guardado = evento as EventoInstalacao;
    avisar();
  });

  window.addEventListener("appinstalled", () => {
    guardado = null;
    avisar();
  });
}

export function assinarInstalacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function temPromptDeInstalacao(): boolean {
  return guardado !== null;
}

export type ResultadoInstalacao = "aceita" | "recusada" | "indisponivel";

/** Abre o diálogo nativo de instalação, quando o navegador oferece um. */
export async function instalarApp(): Promise<ResultadoInstalacao> {
  if (!guardado) return "indisponivel";
  const evento = guardado;
  guardado = null;
  avisar();
  await evento.prompt();
  const escolha = await evento.userChoice;
  return escolha.outcome === "accepted" ? "aceita" : "recusada";
}

/** Verdadeiro quando o app já está aberto instalado, fora do navegador. */
export function jaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const comoApp = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // Safari no iOS não implementa display-mode: usa navigator.standalone.
  const noIOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return comoApp || noIOS;
}

export type Plataforma = "ios" | "android" | "outro";

/** Só para escolher as instruções manuais certas quando não há prompt nativo. */
export function plataforma(): Plataforma {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS recente se apresenta como Macintosh com suporte a toque.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  return "outro";
}

/**
 * Registra o service worker. Ele não guarda cache — serve para o navegador
 * reconhecer o app como instalável.
 */
export function registrarServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((erro) => {
    console.error("Falha ao registrar o service worker:", erro);
  });
}

export type EstadoNotificacoes = "indisponivel" | "default" | "granted" | "denied";

export function estadoDasNotificacoes(): EstadoNotificacoes {
  if (typeof window === "undefined" || !("Notification" in window)) return "indisponivel";
  return Notification.permission as EstadoNotificacoes;
}

/** Pede a permissão de notificação ao navegador. */
export async function pedirNotificacoes(): Promise<EstadoNotificacoes> {
  if (typeof window === "undefined" || !("Notification" in window)) return "indisponivel";
  try {
    return (await Notification.requestPermission()) as EstadoNotificacoes;
  } catch (erro) {
    console.error("Falha ao pedir permissão de notificação:", erro);
    return estadoDasNotificacoes();
  }
}

/* --------------------------------------------- o que já foi visto por aqui */

/**
 * O que o usuário já viu é marcado por dispositivo, não na conta: instalar na
 * tela de início é ação de cada aparelho, e o tour completo abre justamente
 * quando o app roda instalado. Quem entra no celular depois de usar o
 * computador precisa ver os dois de novo.
 */
export type Guia = "tutorial" | "tour";

function chave(guia: Guia, uid: string): string {
  return `adonai:${guia}:${uid}`;
}

export function guiaVisto(guia: Guia, uid: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(chave(guia, uid)) === "1";
  } catch {
    // Navegação privada ou armazenamento bloqueado: não insiste.
    return true;
  }
}

export function marcarGuiaVisto(guia: Guia, uid: string): void {
  try {
    window.localStorage.setItem(chave(guia, uid), "1");
  } catch {
    // Sem armazenamento o guia reaparece no próximo acesso; sem problema.
  }
}

export function reabrirGuia(guia: Guia, uid: string): void {
  try {
    window.localStorage.removeItem(chave(guia, uid));
  } catch {
    // Sem armazenamento não há o que limpar.
  }
}

/* ------------------------------------------------- cadastro deixado para depois */

/**
 * O formulário de primeiro acesso cobre a tela inteira, então enquanto não
 * fosse respondido nenhuma aba respondia ao toque — o app parecia travado.
 * Agora ele pode ser adiado, e o adiamento fica guardado neste aparelho para
 * não reaparecer a cada navegação. Quem adia continua vendo a tarja de aviso
 * no topo do app até completar.
 */
function chaveCadastro(uid: string): string {
  return `adonai:cadastro-adiado:${uid}`;
}

export function cadastroAdiado(uid: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(chaveCadastro(uid)) === "1";
  } catch {
    // Sem armazenamento, não insiste: melhor deixar passar que travar a tela.
    return true;
  }
}

export function adiarCadastro(uid: string): void {
  try {
    window.localStorage.setItem(chaveCadastro(uid), "1");
  } catch {
    // Sem armazenamento o formulário reaparece na próxima abertura.
  }
}

/** Chamado ao concluir o cadastro: o adiamento perde o sentido. */
export function limparAdiamentoDoCadastro(uid: string): void {
  try {
    window.localStorage.removeItem(chaveCadastro(uid));
  } catch {
    // Nada a limpar.
  }
}
