/**
 * Código de convite: o que a direção entrega e a pessoa digita.
 *
 * O convite existe porque o caminho anterior era torto: a pessoa criava uma
 * conta qualquer em "Criar minha conta", entrava sem ver nada, e a direção
 * depois adivinhava quem era aquele e-mail para ligar à ficha. Com o convite a
 * direção decide antes quem é quem — o código já carrega a ficha — e a pessoa
 * entra pronta, com histórico e personagem no lugar.
 */

/*
 * Alfabeto sem os pares que se confundem à mão ou no olho: O/0, I/1/L, S/5,
 * B/8, Z/2. Sobram 25 símbolos, e oito posições dão 25^8 ≈ 1,5 * 10^11
 * combinações — o suficiente para que adivinhar um código não seja caminho, e
 * curto o bastante para ser ditado por telefone.
 */
const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
export const TAMANHO_DO_CODIGO = 8;

/** Código novo, aleatório de fonte criptográfica. */
export function gerarCodigo(): string {
  const bytes = new Uint8Array(TAMANHO_DO_CODIGO);
  crypto.getRandomValues(bytes);
  /*
   * O resto de 256 por 25 não é zero, então o módulo puro favoreceria as
   * primeiras letras do alfabeto. Num código de convite isso não abre ataque
   * prático, mas descartar o excedente custa uma linha e tira a dúvida.
   */
  let codigo = "";
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    while (b >= 256 - (256 % ALFABETO.length)) {
      const extra = new Uint8Array(1);
      crypto.getRandomValues(extra);
      b = extra[0];
    }
    codigo += ALFABETO[b % ALFABETO.length];
  }
  return codigo;
}

/**
 * Deixa o que a pessoa digitou na forma guardada: maiúsculas, sem separador.
 *
 * Aceita o código com hífen, com espaço e em minúsculas porque é assim que ele
 * chega — copiado do WhatsApp, ditado ao telefone ou lido de um papel.
 */
export function normalizarCodigo(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TAMANHO_DO_CODIGO);
}

/** Forma de mostrar: `ACDE-4679`. O hífen só existe para a leitura. */
export function formatarCodigo(codigo: string): string {
  const limpo = normalizarCodigo(codigo);
  if (limpo.length <= 4) return limpo;
  return `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}

export function codigoCompleto(codigo: string): boolean {
  return normalizarCodigo(codigo).length === TAMANHO_DO_CODIGO;
}

/**
 * Endereço que o QR code carrega.
 *
 * É um link, não o código solto: assim a câmera nativa do celular também
 * resolve o convite, sem depender de a pessoa abrir o app primeiro e achar o
 * leitor. O leitor de dentro do app continua existindo para quem já está na
 * tela de entrar.
 */
export function linkDoConvite(codigo: string, origem?: string): string {
  const base =
    origem ?? (typeof window === "undefined" ? "https://adonaiapp.web.app" : window.location.origin);
  return `${base}/convite?c=${normalizarCodigo(codigo)}`;
}

/** Extrai o código de um link de convite ou de um código digitado. */
export function codigoDoTexto(texto: string): string | null {
  const bruto = texto.trim();
  try {
    const url = new URL(bruto);
    const doParametro = url.searchParams.get("c");
    if (doParametro) {
      const limpo = normalizarCodigo(doParametro);
      return codigoCompleto(limpo) ? limpo : null;
    }
  } catch {
    // Não é URL: segue como código digitado.
  }
  const limpo = normalizarCodigo(bruto);
  return codigoCompleto(limpo) ? limpo : null;
}
