"use client";

import { buscarPecaAtual, listarPersonagensDaPessoa } from "./db";
import { useAuth } from "./auth-context";
import { useCarregar } from "./hooks";
import type { Character, Play } from "./types";

export interface ContextoAtual {
  peca: Play | null;
  /**
   * Todos os papéis da pessoa na peça atual, do mais relevante para o menos.
   * Vazio significa que ela não está escalada.
   */
  personagens: Character[];
}

/**
 * Peça atual e os papéis do usuário nela.
 *
 * Lista, e não um só: a mesma pessoa pode acumular papéis numa peça — em "A
 * Resposta" alguém fez assistente, guerreiro e narrador. Onde só cabe um, a
 * interface usa o primeiro, que é o de menor `ordem`.
 */
export function useAtual() {
  const { pessoa } = useAuth();
  return useCarregar<ContextoAtual>("peca-atual", async () => {
    const peca = await buscarPecaAtual();
    const personagens =
      peca && pessoa ? await listarPersonagensDaPessoa(peca.id, pessoa.id) : [];
    return { peca, personagens };
  }, [pessoa?.id]);
}
