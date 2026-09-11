"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mensagemDeErro } from "./erros";

interface Resposta<T> {
  chave: string;
  dados: T | null;
  erro: string | null;
}

export interface Recurso<T> {
  dados: T | null;
  /** Verdadeiro só enquanto não há nada para mostrar — nem do cache. */
  carregando: boolean;
  /** Verdadeiro quando há dados na tela e uma busca nova está em curso. */
  atualizando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/*
 * Cache das consultas de tela.
 *
 * Sem ele, trocar de aba refazia tudo do zero: ir ao Roteiro e voltar ao Início
 * mostrava esqueleto e buscava de novo. Com ele, o que já foi carregado aparece
 * na hora e é revalidado por trás.
 *
 * A chave junta um nome dado por quem chama com as dependências. O nome é
 * obrigatório de propósito: metade das telas usa `[]` como dependência, então
 * sem nome elas colidiriam e uma mostraria os dados da outra.
 *
 * Erros não entram no cache — voltar para uma tela deve tentar de novo, não
 * exibir na hora a falha da vez anterior.
 */
const cache = new Map<string, Resposta<unknown>>();
const LIMITE = 60;

/*
 * O mesmo cache, agora também em disco.
 *
 * O da memória resolve a troca de aba, mas morre quando o app fecha — e é
 * justamente abrir o app que doía: no 4G de um ginásio, a tela de Pessoas
 * levava quase oito segundos de tela vazia. O tempo não era de banda (o
 * JavaScript já vinha do cache do navegador), era a soma das idas e voltas
 * até o servidor, com a pessoa olhando um esqueleto enquanto isso.
 *
 * Guardando a última resposta em disco, a abertura seguinte pinta na hora com
 * o que já se sabia e a busca no servidor continua por trás, trocando o
 * conteúdo quando chega. É o contrário do defeito antigo do `getDocsFromCache`:
 * lá o cache era tratado como resposta final; aqui ele é só o que se mostra
 * enquanto a resposta verdadeira não chega.
 */
const DISCO = "adonai:tela:";
/** Depois disto o disco não serve mais: melhor o esqueleto que o retrato de ontem. */
const VALIDADE = 24 * 60 * 60 * 1000;
/** Payload maior que isto não vai para o disco; a cota do navegador é pequena. */
const MAIOR_PAYLOAD = 400 * 1024;

/*
 * De quem é o que está guardado.
 *
 * O disco sobrevive ao logout, então a chave carrega o uid e a leitura só
 * aceita entradas da conta atual. `limparCacheDeTelas` apaga tudo na troca;
 * o uid na chave é a segunda tranca, para o caso de o app fechar no meio.
 */
let contaDoCache: string | null = null;

export function definirContaDoCache(uid: string | null): void {
  contaDoCache = uid;
}

function chaveNoDisco(chave: string): string {
  return `${DISCO}${contaDoCache}|${chave}`;
}

function lerDoDisco<T>(chave: string): Resposta<T> | null {
  if (typeof window === "undefined" || !contaDoCache) return null;
  try {
    const cru = window.localStorage.getItem(chaveNoDisco(chave));
    if (!cru) return null;
    const { em, dados } = JSON.parse(cru) as { em: number; dados: T };
    if (!em || Date.now() - em > VALIDADE) {
      window.localStorage.removeItem(chaveNoDisco(chave));
      return null;
    }
    return { chave, dados, erro: null };
  } catch {
    // Entrada corrompida ou acesso negado (janela anônima): segue sem disco.
    return null;
  }
}

function gravarNoDisco(chave: string, dados: unknown): void {
  if (typeof window === "undefined" || !contaDoCache) return;
  try {
    const texto = JSON.stringify({ em: Date.now(), dados });
    if (texto.length > MAIOR_PAYLOAD) return;
    window.localStorage.setItem(chaveNoDisco(chave), texto);
  } catch {
    // Cota estourada: larga o que é nosso e desiste desta gravação.
    limparDisco();
  }
}

function limparDisco(): void {
  if (typeof window === "undefined") return;
  try {
    const alvos: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(DISCO)) alvos.push(k);
    }
    alvos.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Sem acesso ao armazenamento: não há o que limpar.
  }
}

/**
 * Descarta o que é de outra conta ou já venceu.
 *
 * O disco sobrevive ao fechar do app, então sem esta varredura as entradas de
 * quem usou o aparelho antes ficariam ocupando a cota para sempre — ilegíveis,
 * porque a chave carrega o uid, mas ocupando.
 */
export function limparDiscoAlheio(): void {
  if (typeof window === "undefined") return;
  try {
    const meu = `${DISCO}${contaDoCache}|`;
    const alvos: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(DISCO)) continue;
      if (!k.startsWith(meu)) {
        alvos.push(k);
        continue;
      }
      try {
        const { em } = JSON.parse(window.localStorage.getItem(k) ?? "{}") as { em?: number };
        if (!em || Date.now() - em > VALIDADE) alvos.push(k);
      } catch {
        alvos.push(k);
      }
    }
    alvos.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Sem acesso ao armazenamento: não há o que varrer.
  }
}

function guardar(chave: string, resposta: Resposta<unknown>): void {
  // Reinsere no fim para o mais recente ficar por último e a poda cortar o mais antigo.
  cache.delete(chave);
  cache.set(chave, resposta);
  if (cache.size > LIMITE) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
  gravarNoDisco(chave, resposta.dados);
}

/**
 * Esvazia o cache. Obrigatório na troca de conta: sem isso, quem entrasse
 * depois veria por um instante os dados de quem saiu.
 */
export function limparCacheDeTelas(): void {
  cache.clear();
  limparDisco();
}

/**
 * Carrega dados assíncronos, recarrega quando `deps` mudam e reaproveita o que
 * já foi carregado nesta sessão.
 *
 * @param nome identificador da consulta, único por tela.
 */
export function useCarregar<T>(
  nome: string,
  carregar: () => Promise<T>,
  deps: unknown[],
): Recurso<T> {
  const chave = `${nome}|${JSON.stringify(deps)}`;
  const [resposta, setResposta] = useState<Resposta<T> | null>(
    () => (cache.get(chave) as Resposta<T> | undefined) ?? null,
  );

  // Guarda a busca e a chave mais recentes para o recarregar manual.
  const acao = useRef(carregar);
  const chaveAtual = useRef(chave);
  useEffect(() => {
    acao.current = carregar;
    chaveAtual.current = chave;
  });

  const registrar = useCallback((nova: Resposta<T>) => {
    if (nova.erro === null) guardar(nova.chave, nova as Resposta<unknown>);
    setResposta(nova);
  }, []);

  const recarregar = useCallback(async () => {
    const alvo = chaveAtual.current;
    try {
      registrar({ chave: alvo, dados: await acao.current(), erro: null });
    } catch (erro) {
      console.error(erro);
      registrar({ chave: alvo, dados: null, erro: mensagemDeErro(erro) });
    }
  }, [registrar]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const dados = await acao.current();
        if (ativo) registrar({ chave, dados, erro: null });
      } catch (erro) {
        console.error(erro);
        if (ativo) registrar({ chave, dados: null, erro: mensagemDeErro(erro) });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [chave, registrar]);

  /*
   * Enquanto a resposta em estado for de outra chave — primeira montagem ou
   * troca de dependência —, vale o que estiver no cache para a chave atual.
   *
   * O disco é o último recurso e é lido uma vez por chave: `localStorage` é
   * síncrono, e reler a cada render deixaria a rolagem pesada.
   */
  const doEstado = resposta && resposta.chave === chave ? resposta : null;
  const doCache = (cache.get(chave) as Resposta<T> | undefined) ?? null;
  const doDisco = useMemo(() => lerDoDisco<T>(chave), [chave]);
  const atual = doEstado ?? doCache ?? doDisco;

  return {
    dados: atual?.dados ?? null,
    carregando: atual === null,
    atualizando: atual !== null && doEstado === null,
    erro: atual?.erro ?? null,
    recarregar,
  };
}

/** Controla o estado de envio de um formulário e centraliza a mensagem de erro. */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(async (acao: () => Promise<void>): Promise<boolean> => {
    setEnviando(true);
    setErro(null);
    try {
      await acao();
      return true;
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
      return false;
    } finally {
      setEnviando(false);
    }
  }, []);

  return { enviando, erro, definirErro: setErro, enviar };
}
