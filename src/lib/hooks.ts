"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function guardar(chave: string, resposta: Resposta<unknown>): void {
  // Reinsere no fim para o mais recente ficar por último e a poda cortar o mais antigo.
  cache.delete(chave);
  cache.set(chave, resposta);
  if (cache.size > LIMITE) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
}

/**
 * Esvazia o cache. Obrigatório na troca de conta: sem isso, quem entrasse
 * depois veria por um instante os dados de quem saiu.
 */
export function limparCacheDeTelas(): void {
  cache.clear();
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
   */
  const doEstado = resposta && resposta.chave === chave ? resposta : null;
  const doCache = (cache.get(chave) as Resposta<T> | undefined) ?? null;
  const atual = doEstado ?? doCache;

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
