"use client";

/** Confirmação de presença no ensaio: resposta do participante e visão da direção. */
import { useState } from "react";
import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { buscarPresenca, listarPresencas, salvarPresenca } from "@/lib/db";
import { useCarregar, useEnvio } from "@/lib/hooks";
import { nomeCurto, pluralizar } from "@/lib/format";
import type { Presenca, Rehearsal } from "@/lib/types";
import { AreaTexto, Aviso, Botao, Divisor, Esqueleto, Status, Tag, juntar } from "../ui";

/* ------------------------------------------------------- lado do participante */

export function ConfirmarPresenca({
  ensaio,
  personId,
  nome,
}: {
  ensaio: Rehearsal;
  personId: string;
  nome: string;
}) {
  const presenca = useCarregar<Presenca | null>("minha-presenca",
    () => buscarPresenca(ensaio.id, personId),
    [ensaio.id, personId],
  );
  const { enviando, erro, enviar } = useEnvio();
  const [justificando, setJustificando] = useState(false);
  const [justificativa, setJustificativa] = useState("");

  const atual = presenca.dados;

  async function responder(estado: "confirmado" | "ausente", texto = "") {
    const ok = await enviar(async () => {
      await salvarPresenca(ensaio.id, personId, nome, estado, texto);
      await presenca.recarregar();
    });
    if (ok) {
      setJustificando(false);
      setJustificativa("");
    }
  }

  if (presenca.carregando) return <Esqueleto className="h-9 w-48" />;

  // Já respondeu: mostra a resposta com a opção de trocar.
  if (atual && !justificando) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-3">
          <Status tom={atual.estado === "confirmado" ? "positivo" : "aviso"}>
            {atual.estado === "confirmado" ? "Você confirmou presença" : "Você avisou que não vai"}
          </Status>
          <Botao
            variante="bare"
            onClick={() =>
              atual.estado === "confirmado"
                ? setJustificando(true)
                : void responder("confirmado")
            }
            disabled={enviando}
            className="gap-1.5"
          >
            <PencilSimple size={14} />
            {atual.estado === "confirmado" ? "Não vou poder ir" : "Mudei, eu vou"}
          </Botao>
        </div>
        {atual.justificativa ? (
          <p className="mt-2 text-[12px] leading-[18px] text-ink-caption">
            Seu recado: {atual.justificativa}
          </p>
        ) : null}
        {erro ? (
          <div className="mt-2">
            <Aviso>{erro}</Aviso>
          </div>
        ) : null}
      </div>
    );
  }

  // Formulário de ausência: a justificativa é opcional, mas ajuda a direção.
  if (justificando) {
    return (
      <div className="w-full space-y-2.5">
        <AreaTexto
          autoFocus
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Quer avisar o motivo? (opcional)"
          className="min-h-[64px]"
          aria-label="Motivo da ausência"
        />
        {erro ? <Aviso>{erro}</Aviso> : null}
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => void responder("ausente", justificativa)} disabled={enviando}>
            {enviando ? "Enviando…" : "Avisar que não vou"}
          </Botao>
          <Botao
            variante="bare"
            onClick={() => {
              setJustificando(false);
              setJustificativa("");
            }}
          >
            Cancelar
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-[12px] leading-[18px] text-ink-caption">
        A direção precisa saber se você vai:
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => void responder("confirmado")} disabled={enviando} className="gap-1.5">
          <Check size={15} />
          Vou ao ensaio
        </Botao>
        <Botao
          variante="ghost"
          onClick={() => setJustificando(true)}
          disabled={enviando}
          className="gap-1.5"
        >
          <X size={15} />
          Não vou poder ir
        </Botao>
      </div>
      {erro ? (
        <div className="mt-2">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ lado da direção */

export function PresencasDoEnsaio({ ensaio }: { ensaio: Rehearsal }) {
  const presencas = useCarregar<Presenca[]>("presencas-do-ensaio", () => listarPresencas(ensaio.id), [ensaio.id]);
  const [aberto, setAberto] = useState(false);

  const lista = presencas.dados ?? [];
  const confirmados = lista.filter((p) => p.estado === "confirmado");
  const ausentes = lista.filter((p) => p.estado === "ausente");
  // Sem "todos", sabemos o denominador; com "todos", depende do elenco da peça.
  const esperados = ensaio.todos ? null : ensaio.convocados.length;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left"
      >
        <Tag tom={confirmados.length > 0 ? "positivo" : "neutro"}>
          {confirmados.length} confirmaram
        </Tag>
        {ausentes.length > 0 ? <Tag tom="aviso">{ausentes.length} não vão</Tag> : null}
        <span className="text-[12px] leading-[18px] text-ink-caption">
          {presencas.carregando
            ? "carregando respostas…"
            : esperados === null
              ? `${pluralizar(lista.length, "resposta", "respostas")} · ${aberto ? "ocultar" : "ver quem"}`
              : `${lista.length} de ${esperados} responderam · ${aberto ? "ocultar" : "ver quem"}`}
        </span>
      </button>

      {aberto ? (
        <div className="mt-3">
          <Divisor className="mb-3" />
          {lista.length === 0 ? (
            <p className="text-[13px] leading-5 text-ink-caption">
              Ninguém respondeu ainda. Um aviso pelo grupo costuma resolver.
            </p>
          ) : (
            <ul className="space-y-2">
              {lista.map((p) => (
                <li key={p.personId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={juntar(
                      "text-[13px] leading-5",
                      p.estado === "confirmado" ? "text-ink-heading" : "text-ink-caption",
                    )}
                  >
                    {nomeCurto(p.nome)}
                  </span>
                  <Status tom={p.estado === "confirmado" ? "positivo" : "aviso"}>
                    {p.estado === "confirmado" ? "vai" : "não vai"}
                  </Status>
                  {p.justificativa ? (
                    <span className="text-[12px] leading-[18px] text-ink-caption">
                      — {p.justificativa}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
