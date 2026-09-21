"use client";

import type { ReactNode } from "react";
import { diaDoMes, diaSemanaEHorario, mesCurto, pluralizar } from "@/lib/format";
import { REHEARSAL_STATUS_LABEL, type Rehearsal, type RehearsalStatus } from "@/lib/types";
import { BlocoData, Cartao, Divisor, Status, Tag, juntar } from "../ui";

const TOM_STATUS: Record<RehearsalStatus, "positivo" | "aviso" | "negativo" | "info" | "neutro"> = {
  agendado: "info",
  confirmado: "positivo",
  alterado: "aviso",
  cancelado: "negativo",
  concluido: "neutro",
};

export function StatusEnsaio({ status }: { status: RehearsalStatus }) {
  return <Status tom={TOM_STATUS[status]}>{REHEARSAL_STATUS_LABEL[status]}</Status>;
}

export function CartaoEnsaio({
  ensaio,
  destaque = false,
  mostrarPeca = false,
  convocado,
  detalheConvocados,
  acoes,
}: {
  ensaio: Rehearsal;
  /** O ensaio mais próximo recebe borda areia. */
  destaque?: boolean;
  mostrarPeca?: boolean;
  /** Quando informado, indica se o usuário logado está convocado. */
  convocado?: boolean;
  detalheConvocados?: string;
  acoes?: ReactNode;
}) {
  const cancelado = ensaio.status === "cancelado";
  // Documento antigo não tem `tipo`: naquela época era tudo ensaio.
  const ehApresentacao = ensaio.tipo === "apresentacao";
  const trechos = ensaio.trechos ?? [];

  return (
    <Cartao
      className={juntar(
        "px-4 py-3.5",
        destaque && "border-brand",
        cancelado && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3.5">
        <BlocoData dia={diaDoMes(ensaio.data)} mes={mesCurto(ensaio.data)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p
              className={juntar(
                "text-[15px] leading-[22px] font-bold text-ink-heading",
                cancelado && "line-through decoration-state-negative",
              )}
            >
              {diaSemanaEHorario(ensaio.data, ensaio.horaInicio, ensaio.horaFim)}
            </p>
            <div className="flex items-center gap-1.5">
              {/*
                * Apresentação leva etiqueta; ensaio não.
                *
                * São o mesmo documento com tipos diferentes, e na lista se
                * misturam. Marcar os dois deixaria "Ensaio" repetido em quase
                * toda linha para dizer o que já é o normal — marca-se o que
                * foge da regra.
                */}
              {ehApresentacao ? <Tag tom="areia">Apresentação</Tag> : null}
              <StatusEnsaio status={ensaio.status} />
            </div>
          </div>

          {ensaio.local || ensaio.nomeEvento || (mostrarPeca && ensaio.playTitulo) ? (
            <p className="mt-1 text-[13px] leading-5 text-ink-caption">
              {[ensaio.nomeEvento, ensaio.local, mostrarPeca ? ensaio.playTitulo : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}

          {trechos.length > 0 ? (
            <p className="mt-1 text-[12px] leading-[18px] text-ink-caption">
              Vai ensaiar{" "}
              {trechos.length === 1
                ? `o ato ${trechos[0].ato}, cena ${trechos[0].cena}`
                : `${trechos.length} cenas: ${trechos.map((t) => `${t.ato}·${t.cena}`).join(", ")}`}
            </p>
          ) : null}

          {ensaio.status === "alterado" ? (
            <p className="mt-1 text-[12px] leading-[18px] text-[#e8be72]">
              Ensaio alterado pela direção. Confira data, horário e local.
            </p>
          ) : null}

          <p className="mt-2 text-[12px] leading-[18px] text-ink-caption">
            {detalheConvocados ??
              (ensaio.todos
                ? "Todo o elenco convocado"
                : pluralizar(ensaio.convocados.length, "convocado", "convocados"))}
          </p>

          {convocado === true ? (
            <Tag tom="areia" className="mt-2">
              Você está convocado
            </Tag>
          ) : null}
          {convocado === false ? (
            <Tag className="mt-2">Você não foi convocado</Tag>
          ) : null}
        </div>
      </div>

      {ensaio.observacoes ? (
        <>
          <Divisor className="my-3" />
          <p className="text-[13px] leading-5 whitespace-pre-line text-ink-body">
            {ensaio.observacoes}
          </p>
        </>
      ) : null}

      {acoes ? (
        <>
          <Divisor className="my-3" />
          <div className="flex flex-wrap gap-2">{acoes}</div>
        </>
      ) : null}
    </Cartao>
  );
}
