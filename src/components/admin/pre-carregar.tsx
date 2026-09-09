"use client";

/**
 * Aquece as consultas da área da direção.
 *
 * As quatro abas (Painel, Pessoas, Peças, Ensaios) leem quase o mesmo conjunto:
 * pessoas, peças, peça atual, características, ensaios e participações. Sem
 * aquecimento cada aba pagava a primeira ida ao servidor por conta própria, e
 * era só nessa primeira visita que o esqueleto de carregamento aparecia.
 *
 * Buscar tudo uma vez ao entrar na direção resolve as quatro: as leituras de
 * `db.ts` respondem do cache local, então quando a pessoa toca numa aba os
 * dados já estão ali. Não é consulta a mais — é a mesma consulta, feita antes
 * de ser esperada, e uma vez em vez de quatro.
 *
 * Roda em tempo ocioso para não disputar banda com a tela que está abrindo, e
 * falha em silêncio: aquecimento é oportunista, quem manda é a tela de verdade.
 */
import { useEffect } from "react";
import {
  buscarPecaAtual,
  listarCaracteristicas,
  listarEnsaios,
  listarPecas,
  listarPersonagens,
  listarPessoas,
  listarTodasParticipacoes,
} from "@/lib/db";

function agendar(tarefa: () => void): () => void {
  const janela = window as Window & {
    requestIdleCallback?: (cb: () => void, opcoes?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (janela.requestIdleCallback) {
    const id = janela.requestIdleCallback(tarefa, { timeout: 1200 });
    return () => janela.cancelIdleCallback?.(id);
  }
  // Safari não tem requestIdleCallback; um atraso curto cumpre o mesmo papel.
  const id = window.setTimeout(tarefa, 400);
  return () => window.clearTimeout(id);
}

export function PreCarregarDirecao() {
  useEffect(() => {
    let ativo = true;

    const cancelar = agendar(() => {
      void (async () => {
        try {
          const [peca] = await Promise.all([
            buscarPecaAtual(),
            listarPessoas(),
            listarPecas(),
            listarCaracteristicas(),
            listarEnsaios(),
            listarTodasParticipacoes(),
          ]);
          // Personagens dependem de saber qual é a peça atual.
          if (ativo && peca) await listarPersonagens(peca.id);
        } catch {
          // Silêncio de propósito: a tela que precisar do dado tenta de novo.
        }
      })();
    });

    return () => {
      ativo = false;
      cancelar();
    };
  }, []);

  return null;
}
