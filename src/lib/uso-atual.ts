"use client";

import { useSyncExternalStore } from "react";
import { listarPecasEmCartaz, listarPersonagensDaPessoa } from "./db";
import { useAuth } from "./auth-context";
import { useCarregar } from "./hooks";
import type { Character, Play } from "./types";

export interface ContextoAtual {
  /** Todas as peças em cartaz, da apresentação mais próxima para a mais longe. */
  pecas: Play[];
  /** A peça que a pessoa está vendo. Nula quando não há nenhuma em cartaz. */
  peca: Play | null;
  /**
   * Todos os papéis da pessoa na peça escolhida, do mais relevante para o
   * menos. Vazio significa que ela não está escalada.
   */
  personagens: Character[];
}

/*
 * Qual peça a pessoa está vendo, guardado no aparelho.
 *
 * Fica fora do React pelo mesmo motivo do tamanho da letra no roteiro: ler
 * `localStorage` no estado inicial diverge da pré-renderização — o app é
 * exportado estático — e `setState` dentro de efeito é recusado pelo
 * compilador. `useSyncExternalStore` pergunta na hora certa.
 *
 * No aparelho e não na conta: é onde a pessoa parou de ler, não uma decisão
 * que ela queira ver repetida em outro celular.
 */
const CHAVE_DA_ESCOLHA = "adonai:peca-escolhida";
let escolhida: string | null | undefined;
const ouvintes = new Set<() => void>();

function lerEscolha(): string | null {
  if (escolhida === undefined) {
    try {
      escolhida = window.localStorage.getItem(CHAVE_DA_ESCOLHA);
    } catch {
      escolhida = null;
    }
  }
  return escolhida;
}

function assinarEscolha(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

function semEscolhaNoServidor(): string | null {
  return null;
}

/** Troca a peça que as telas do elenco mostram. */
export function escolherPeca(playId: string): void {
  escolhida = playId;
  try {
    window.localStorage.setItem(CHAVE_DA_ESCOLHA, playId);
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
  ouvintes.forEach((avisar) => avisar());
}

/**
 * Qual peça a pessoa escolheu, para quem carrega os dados por conta própria.
 *
 * O Início monta a tela num carregamento só, em três passos, e não passa por
 * `useAtual`; sem enxergar a escolha, ele responderia uma peça diferente da
 * que o Roteiro está mostrando.
 */
export function usePecaEscolhida(): string | null {
  return useSyncExternalStore(assinarEscolha, lerEscolha, semEscolhaNoServidor);
}

/**
 * As peças em cartaz, a escolhida, e os papéis da pessoa nela.
 *
 * Lista de papéis, e não um só: a mesma pessoa pode acumular papéis numa peça
 * — em "A Resposta" alguém fez assistente, guerreiro e narrador. Onde só cabe
 * um, a interface usa o primeiro, que é o de menor `ordem`.
 */
export function useAtual() {
  const { pessoa } = useAuth();
  const preferida = useSyncExternalStore(assinarEscolha, lerEscolha, semEscolhaNoServidor);

  return useCarregar<ContextoAtual>(
    "peca-atual",
    async () => {
      const pecas = await listarPecasEmCartaz();
      /*
       * A escolha guardada só vale enquanto a peça continuar em cartaz — peça
       * concluída sai de cartaz e a escolha apontaria para o vazio, deixando o
       * elenco numa tela que diz "nenhuma peça em andamento" com duas em
       * andamento. Sem escolha válida, vale a primeira: a de apresentação mais
       * próxima.
       */
      const peca = pecas.find((p) => p.id === preferida) ?? pecas[0] ?? null;
      const personagens =
        peca && pessoa ? await listarPersonagensDaPessoa(peca.id, pessoa.id) : [];
      return { pecas, peca, personagens };
    },
    [pessoa?.id, preferida],
  );
}
