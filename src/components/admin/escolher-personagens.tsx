"use client";

/**
 * Quem diz a linha — um, vários, ou o elenco inteiro.
 *
 * Substituiu uma lista suspensa de escolha única. Roteiro tem fala em coro:
 * "Pai e Mãe: você não devia ter nascido!", a peça inteira gritando junto. Com
 * escolha única, essas linhas ou eram duplicadas — e apareciam repetidas no
 * roteiro — ou ficavam sem dono, e quem ficasse sem dono não via a própria
 * fala destacada. O destaque é o que o app existe para fazer.
 *
 * Lista de botões em vez de `<select multiple>`: seleção múltipla nativa no
 * celular pede toque com tecla junto, que não existe ali. Aqui cada nome é um
 * alvo de toque que liga e desliga.
 */
import { Check } from "@phosphor-icons/react";
import type { Character } from "@/lib/types";
import { juntar } from "../ui";

export function EscolherPersonagens({
  personagens,
  selecionados,
  onMudar,
  desabilitado = false,
}: {
  personagens: Character[];
  /** Ids escolhidos. A ordem é a de seleção, e é ela que o roteiro mostra. */
  selecionados: string[];
  onMudar: (ids: string[]) => void;
  desabilitado?: boolean;
}) {
  const marcados = new Set(selecionados);
  const todos = personagens.length > 0 && selecionados.length === personagens.length;

  function alternar(id: string) {
    // Tira mantendo a ordem dos outros; põe no fim, que é a ordem de leitura.
    onMudar(marcados.has(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {personagens.map((personagem) => {
          const marcado = marcados.has(personagem.id);
          return (
            <button
              key={personagem.id}
              type="button"
              disabled={desabilitado}
              onClick={() => alternar(personagem.id)}
              aria-pressed={marcado}
              className={juntar(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] leading-5 transition-colors disabled:opacity-50",
                marcado
                  ? "border-brand bg-brand font-medium text-brand-ink"
                  : "border-stroke-frame text-ink-body hover:bg-surface-hover",
              )}
            >
              {marcado ? <Check size={13} weight="bold" /> : null}
              {personagem.nome}
            </button>
          );
        })}
      </div>

      {personagens.length > 1 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => onMudar(todos ? [] : personagens.map((p) => p.id))}
            className="text-[12px] leading-[18px] font-medium text-brand-strong hover:underline disabled:opacity-50"
          >
            {todos ? "Limpar" : "Elenco inteiro"}
          </button>
          <span className="text-[12px] leading-[18px] text-ink-caption">
            {selecionados.length === 0
              ? "ninguém escolhido"
              : selecionados.length === 1
                ? "1 personagem"
                : `${selecionados.length} personagens — fala em coro`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
