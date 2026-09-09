/**
 * Chamadas às Cloud Functions.
 *
 * Só o resgate de convite passa por aqui: é a única operação que o navegador
 * não pode fazer nem com regra bem escrita, porque envolve criar a conta e
 * ligá-la a uma ficha do cadastro.
 *
 * A região é declarada. Sem isso o SDK aponta para `us-central1`, e as funções
 * deste projeto estão em São Paulo — a chamada simplesmente não encontraria
 * nada, com um erro de rede que não explica o motivo.
 */
import { getFunctions, httpsCallable, type FunctionsError } from "firebase/functions";
import app from "./firebase";

const funcoes = getFunctions(app, "southamerica-east1");

export interface ConviteConferido {
  nome: string;
  email: string;
}

export async function conferirConvite(codigo: string): Promise<ConviteConferido> {
  const chamar = httpsCallable<{ codigo: string }, ConviteConferido>(funcoes, "conferirConvite");
  return (await chamar({ codigo })).data;
}

export async function resgatarConvite(dados: {
  codigo: string;
  nome: string;
  email: string;
  senha: string;
}): Promise<{ email: string }> {
  const chamar = httpsCallable<typeof dados, { ok: boolean; email: string }>(
    funcoes,
    "resgatarConvite",
  );
  return (await chamar(dados)).data;
}

/**
 * Mensagem que a pessoa lê quando a chamada falha.
 *
 * As funções já devolvem texto pronto em português — "Este código já foi
 * usado", "Confira com a direção" — e é esse texto que precisa aparecer. O
 * genérico fica só para queda de rede, quando não há mensagem do outro lado.
 *
 * O SDK cola o status HTTP no fim do `message`, então a pessoa lia "Não
 * encontramos este código. Confira com a direção. [404]". O servidor manda a
 * frase limpa; o sufixo é do cliente, e sai aqui.
 */
export function mensagemDeFuncao(erro: unknown): string {
  const falha = erro as FunctionsError;
  if (falha?.code === "functions/internal" || !falha?.message) {
    return "Não foi possível concluir agora. Confira sua conexão e tente de novo.";
  }
  return falha.message.replace(/\s*\[\d{3}\]\s*$/, "");
}
