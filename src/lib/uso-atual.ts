"use client";

import { buscarPecaAtual, buscarPersonagemDaPessoa } from "./db";
import { useAuth } from "./auth-context";
import { useCarregar } from "./hooks";
import type { Character, Play } from "./types";

export interface ContextoAtual {
  peca: Play | null;
  personagem: Character | null;
}

/**
 * Peça atual e o personagem do usuário nela. `personagem` nulo significa que a
 * pessoa não está escalada — a interface mostra "Nos vemos na próxima peça!".
 */
export function useAtual() {
  const { pessoa } = useAuth();
  return useCarregar<ContextoAtual>("peca-atual", async () => {
    const peca = await buscarPecaAtual();
    const personagem =
      peca && pessoa ? await buscarPersonagemDaPessoa(peca.id, pessoa.id) : null;
    return { peca, personagem };
  }, [pessoa?.id]);
}
