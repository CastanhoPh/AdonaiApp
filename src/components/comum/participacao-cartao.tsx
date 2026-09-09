"use client";

import { ano } from "@/lib/format";
import { ROLE_TYPE_LABEL, type Participation } from "@/lib/types";
import { Tag } from "../ui";

/**
 * Uma linha do histórico: coluna de ano à esquerda, peça e personagem no
 * meio, tipo do papel como tag. Divisória em stroke-list entre linhas.
 */
export function LinhaParticipacao({ participacao }: { participacao: Participation }) {
  return (
    <li className="flex items-start gap-4 border-b border-stroke-list py-3.5 last:border-0">
      <span className="fonte-num w-10 shrink-0 text-[13px] leading-5 font-bold text-ink-caption">
        {ano(participacao.periodo)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[22px] font-bold text-ink-heading">
          {participacao.playTitulo}
        </p>
        <p className="text-[13px] leading-5 text-ink-body">{participacao.characterNome}</p>
      </div>
      <Tag className="mt-0.5">{ROLE_TYPE_LABEL[participacao.tipoPapel]}</Tag>
    </li>
  );
}
