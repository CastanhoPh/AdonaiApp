"use client";

/**
 * Qual peça o elenco está vendo, quando há mais de uma em cartaz.
 *
 * **Não aparece com uma peça só**, que é o caso da maioria das pessoas na
 * maior parte do tempo. Um seletor permanente na tela de quem só quer abrir e
 * ler a própria fala é custo cobrado de todos para resolver o caso de alguns —
 * e quando há duas produções em paralelo, quase ninguém está nas duas.
 *
 * A escolha vale para todas as telas do elenco de uma vez: trocar no Roteiro
 * troca no Início e nos Ensaios junto. Peça é o contexto inteiro, não um
 * filtro de uma tela.
 */
import { escolherPeca } from "@/lib/uso-atual";
import type { Play } from "@/lib/types";
import { juntar } from "../ui";

export function TrocarPeca({ pecas, escolhida }: { pecas: Play[]; escolhida: Play | null }) {
  if (pecas.length < 2) return null;

  return (
    <div
      className="mb-4 flex gap-1.5 overflow-x-auto"
      role="tablist"
      aria-label="Peça em cartaz"
    >
      {pecas.map((peca) => {
        const ativa = peca.id === escolhida?.id;
        return (
          <button
            key={peca.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => escolherPeca(peca.id)}
            className={juntar(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] leading-5 transition-colors",
              ativa
                ? "border-brand bg-brand font-medium text-brand-ink"
                : "border-stroke-frame text-ink-body hover:bg-surface-hover",
            )}
          >
            {peca.titulo}
          </button>
        );
      })}
    </div>
  );
}
