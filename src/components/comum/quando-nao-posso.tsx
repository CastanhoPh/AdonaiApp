"use client";

/**
 * Avisar que não pode, antes de a direção marcar.
 *
 * A confirmação de presença é reativa: a direção marca, o elenco responde, e
 * só então se descobre que metade não pode — e remarca. Remarcação é o que
 * mais custa a um grupo que ensaia à noite, de graça, no meio da semana.
 *
 * Aqui a pessoa diz antes. Um dia, ou um intervalo; com motivo ou sem. Quem lê
 * é a direção, na hora de escolher a data, e mais ninguém: o motivo é assunto
 * de quem escreveu, e a agenda de cada um não é informação que o grupo precise.
 */
import { useState } from "react";
import { CalendarX, Trash } from "@phosphor-icons/react";
import {
  avisarIndisponibilidade,
  listarIndisponibilidadesDaPessoa,
  removerIndisponibilidade,
} from "@/lib/db";
import { dataCurta, hojeISO } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import type { Indisponibilidade, Person } from "@/lib/types";
import { Aviso, Botao, BotaoIcone, Campo, Cartao, Entrada, Eyebrow, Modal } from "../ui";

export function QuandoNaoPosso({ pessoa }: { pessoa: Person }) {
  const hoje = hojeISO();
  const avisos = useCarregar<Indisponibilidade[]>(
    "meus-avisos-de-ausencia",
    () => listarIndisponibilidadesDaPessoa(pessoa.id, hoje),
    [pessoa.id, hoje],
  );
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ de: "", ate: "", motivo: "" });

  const lista = avisos.dados ?? [];

  function abrir() {
    setForm({ de: "", ate: "", motivo: "" });
    definirErro(null);
    setAberto(true);
  }

  async function salvar() {
    if (!form.de) {
      definirErro("Informe o dia em que você não pode.");
      return;
    }
    // Um dia só: `ate` vazio repete `de`, em vez de obrigar a digitar duas vezes.
    const ate = form.ate || form.de;
    if (ate < form.de) {
      definirErro("O último dia não pode ser antes do primeiro.");
      return;
    }
    const ok = await enviar(async () => {
      await avisarIndisponibilidade({
        personId: pessoa.id,
        personNome: pessoa.nome,
        de: form.de,
        ate,
        motivo: form.motivo.trim(),
      });
      await avisos.recarregar();
    });
    if (ok) setAberto(false);
  }

  async function apagar(id: string) {
    await enviar(async () => {
      await removerIndisponibilidade(id);
      await avisos.recarregar();
    });
  }

  return (
    <Cartao className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Eyebrow>Quando eu não posso</Eyebrow>
          <p className="mt-1 text-[13px] leading-5 text-ink-caption">
            Avise antes e a direção evita marcar ensaio num dia em que você já sabe que não vai.
          </p>
        </div>
        <Botao variante="ghost" onClick={abrir} className="gap-1.5">
          <CalendarX size={15} />
          Avisar
        </Botao>
      </div>

      {lista.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {lista.map((aviso) => (
            <li
              key={aviso.id}
              className="flex items-center justify-between gap-3 border-t border-stroke-list pt-2.5 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="text-[14px] leading-[21px] text-ink-heading">
                  {aviso.de === aviso.ate
                    ? dataCurta(aviso.de)
                    : `${dataCurta(aviso.de)} a ${dataCurta(aviso.ate)}`}
                </p>
                {aviso.motivo ? (
                  <p className="truncate text-[12px] leading-[18px] text-ink-caption">
                    {aviso.motivo}
                  </p>
                ) : null}
              </div>
              <BotaoIcone
                rotulo="Apagar este aviso"
                onClick={() => void apagar(aviso.id)}
                className="hover:text-state-negative"
              >
                <Trash size={16} />
              </BotaoIcone>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal
        titulo="Quando você não pode"
        aberto={aberto}
        onFechar={() => setAberto(false)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void salvar()} disabled={enviando}>
              {enviando ? "Salvando…" : "Avisar"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="A partir de" obrigatorio>
              <Entrada
                type="date"
                min={hoje}
                value={form.de}
                onChange={(e) => setForm({ ...form, de: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Até" dica="Deixe vazio se for um dia só.">
              <Entrada
                type="date"
                min={form.de || hoje}
                value={form.ate}
                onChange={(e) => setForm({ ...form, ate: e.target.value })}
              />
            </Campo>
          </div>
          <Campo etiqueta="Motivo" dica="Opcional. Só a direção lê.">
            <Entrada
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder="Prova na faculdade"
            />
          </Campo>
          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>
    </Cartao>
  );
}
