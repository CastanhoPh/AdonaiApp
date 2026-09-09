"use client";

import { useState } from "react";
import { atualizarPeca, concluirPeca, definirPecaAtual } from "@/lib/db";
import { dataLonga, hojeISO, pluralizar } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import { LADO_CENA, caminhoDaCapaDaPeca } from "@/lib/armazenamento";
import { PLAY_STATUS, PLAY_STATUS_LABEL, type Play, type PlayStatus } from "@/lib/types";
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  Divisor,
  Entrada,
  Modal,
  Selecao,
  TituloSecao,
} from "@/components/ui";
import { EnviarFoto } from "@/components/comum/enviar-foto";

export function AbaDados({
  peca,
  escalados,
  onAtualizar,
}: {
  peca: Play;
  /** Quantas pessoas estão escaladas — usado no aviso de conclusão. */
  escalados: number;
  onAtualizar: () => Promise<void>;
}) {
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [form, setForm] = useState({
    titulo: peca.titulo,
    nomeEvento: peca.nomeEvento ?? "",
    descricao: peca.descricao ?? "",
    capaUrl: peca.capaUrl ?? "",
    dataApresentacao: peca.dataApresentacao ?? "",
    local: peca.local ?? "",
    status: peca.status,
  });
  const [salvo, setSalvo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function salvarCapa(url: string) {
    setForm({ ...form, capaUrl: url });
    await enviar(async () => {
      await atualizarPeca(peca.id, { capaUrl: url });
      await onAtualizar();
    });
  }

  async function salvar() {
    setSalvo(false);
    if (!form.titulo.trim()) {
      definirErro("Informe o título da peça.");
      return;
    }
    const ok = await enviar(async () => {
      await atualizarPeca(peca.id, {
        titulo: form.titulo.trim(),
        nomeEvento: form.nomeEvento.trim(),
        descricao: form.descricao.trim(),
        capaUrl: form.capaUrl.trim(),
        dataApresentacao: form.dataApresentacao,
        local: form.local.trim(),
        status: form.status as PlayStatus,
      });
      await onAtualizar();
    });
    if (ok) setSalvo(true);
  }

  async function tornarAtual() {
    await enviar(async () => {
      await definirPecaAtual(peca.id);
      await onAtualizar();
    });
  }

  async function concluir() {
    const ok = await enviar(async () => {
      await concluirPeca(peca.id);
      await onAtualizar();
    });
    if (ok) setConfirmando(false);
  }

  return (
    <div className="grid gap-4 min-[900px]:grid-cols-[1.1fr_1fr]">
      <Cartao className="px-4 py-4">
        <TituloSecao titulo="Dados da peça" />

        <div className="space-y-3.5">
          <Campo etiqueta="Título" obrigatorio>
            <Entrada
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Nome do evento" dica="Opcional. É o que dá contexto no histórico.">
            <Entrada
              value={form.nomeEvento}
              onChange={(e) => setForm({ ...form, nomeEvento: e.target.value })}
              placeholder="Ex.: Congresso de Jovens 2026"
            />
          </Campo>
          <Campo etiqueta="Descrição">
            <AreaTexto
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Capa da peça">
            {/* Grava na hora: o arquivo já subiu, ver aba-personagens. */}
            <EnviarFoto
              caminho={caminhoDaCapaDaPeca(peca.id)}
              atual={form.capaUrl}
              ladoMaximo={LADO_CENA}
              formato="retangulo"
              rotulo="Escolher capa"
              onEnviada={(url) => salvarCapa(url)}
              onRemovida={() => salvarCapa("")}
              desabilitado={enviando}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Data da apresentação">
              <Entrada
                type="date"
                value={form.dataApresentacao}
                onChange={(e) => setForm({ ...form, dataApresentacao: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Local">
              <Entrada
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Templo sede"
              />
            </Campo>
          </div>
          <Campo etiqueta="Status">
            <Selecao
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PlayStatus })}
            >
              {PLAY_STATUS.map((s) => (
                <option key={s} value={s}>
                  {PLAY_STATUS_LABEL[s]}
                </option>
              ))}
            </Selecao>
          </Campo>

          {erro ? <Aviso>{erro}</Aviso> : null}
          {salvo ? <Aviso tom="positivo">Dados salvos.</Aviso> : null}

          <Botao onClick={() => void salvar()} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar alterações"}
          </Botao>
        </div>
      </Cartao>

      <Cartao className="px-4 py-4">
        <TituloSecao
          titulo="Situação da produção"
          descricao="Somente uma peça é considerada a peça atual pelos participantes."
        />

        <div className="space-y-3">
          {peca.status === "concluida" ? (
            <Aviso tom="positivo">
              Peça concluída. As participações de quem estava escalado foram registradas no
              histórico.
            </Aviso>
          ) : null}

          {peca.atual ? (
            <Aviso tom="info">Esta é a peça atual do teatro.</Aviso>
          ) : peca.status === "concluida" ? null : (
            <Botao variante="ghost" onClick={() => void tornarAtual()} disabled={enviando}>
              Definir como peça atual
            </Botao>
          )}
        </div>

        {peca.status !== "concluida" ? (
          <>
            <Divisor className="my-4" />
            <p className="mb-3 text-[13px] leading-5 text-ink-caption">
              Concluir a peça registra a participação de cada pessoa escalada no histórico dela e
              retira a peça da posição de peça atual.
            </p>
            <Botao variante="ghost" onClick={() => setConfirmando(true)} disabled={enviando}>
              Concluir peça
            </Botao>
          </>
        ) : null}
      </Cartao>

      <Modal
        titulo="Concluir a peça?"
        aberto={confirmando}
        onFechar={() => setConfirmando(false)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void concluir()} disabled={enviando}>
              {enviando ? "Concluindo…" : "Concluir peça"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3 text-[14px] leading-[21px] text-ink-body">
          <p>
            <strong className="text-ink-heading">{peca.titulo}</strong> será marcada como concluída
            em {dataLonga(hojeISO())}.
          </p>
          <p>
            {escalados === 0
              ? "Nenhuma pessoa está escalada, então nenhum histórico será criado."
              : `${pluralizar(escalados, "pessoa escalada terá", "pessoas escaladas terão")} a participação registrada no histórico.`}
          </p>
          <Aviso tom="aviso">
            A peça deixará de ser a peça atual e os participantes verão “Nos vemos na próxima
            peça!” até que outra seja definida.
          </Aviso>
        </div>
      </Modal>
    </div>
  );
}
