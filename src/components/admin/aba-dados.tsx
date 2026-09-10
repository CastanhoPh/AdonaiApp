"use client";

import { useState } from "react";
import { atualizarPeca, concluirPeca, definirPecaAtual } from "@/lib/db";
import { dataLonga, hojeISO, pluralizar } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import { LADO_CENA, caminhoDaCapaDaPeca } from "@/lib/armazenamento";
import { PLAY_STATUS, PLAY_STATUS_LABEL, type Play, type PlayStatus } from "@/lib/types";
import {
  Caixa,
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  Divisor,
  Entrada,
  Modal,
  Selecao,
  Tag,
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
    elencoFechado: peca.elencoFechado ?? false,
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
    const gravado = {
      titulo: form.titulo.trim(),
      nomeEvento: form.nomeEvento.trim(),
      descricao: form.descricao.trim(),
      capaUrl: form.capaUrl.trim(),
      elencoFechado: form.elencoFechado,
      dataApresentacao: form.dataApresentacao,
      local: form.local.trim(),
      status: form.status as PlayStatus,
    };
    const ok = await enviar(async () => {
      await atualizarPeca(peca.id, gravado);
      await onAtualizar();
    });
    if (!ok) return;
    /*
     * O formulário passa a mostrar exatamente o que foi gravado — os textos
     * vão aparados, e antes o campo continuava com o espaço em volta até a
     * página remontar. Sincronizar aqui é o que permitiu tirar `titulo` e
     * `status` da chave de remontagem, que apagava o aviso de sucesso.
     */
    setForm({ ...form, ...gravado });
    setSalvo(true);
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
    if (!ok) return;
    // Concluir muda o status fora do formulário; o campo tem de acompanhar.
    setForm((atual) => ({ ...atual, status: "concluida" }));
    setConfirmando(false);
  }

  return (
    /*
      `items-start` é o que conserta o pior desta tela: sem ele a grade
      esticava o cartão da direita até a altura do formulário, e "Situação da
      produção" — que tem três linhas de conteúdo — virava um retângulo com
      dois palmos de vazio dentro.
    */
    <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <Cartao className="overflow-hidden">
        <div className="border-b border-stroke-list px-4 py-3">
          <h3 className="text-[14px] leading-5 font-bold text-ink-heading">Dados da peça</h3>
        </div>

        <div className="space-y-3.5 px-4 py-4">
          {/*
            Os campos curtos entram em pares. Um por linha deixava o formulário
            com o dobro da altura sem usar a largura que a coluna já tem.
          */}
          <div className="grid gap-3.5 min-[560px]:grid-cols-2">
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
          </div>

          <div className="grid gap-3.5 min-[560px]:grid-cols-2">
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

          {/*
            * Separado do status de propósito: status é a fase da produção,
            * isto responde "ainda dá para entrar nessa peça?".
            */}
          <div className="-mx-2">
            <Caixa
              marcada={form.elencoFechado}
              onClick={() => setForm({ ...form, elencoFechado: !form.elencoFechado })}
              descricao="Marque quando a escalação estiver definida. Em aberto significa que ainda falta gente ou falta lembrar quem fez o quê."
            >
              Elenco fechado
            </Caixa>
          </div>

          {erro ? <Aviso>{erro}</Aviso> : null}
          {salvo ? <Aviso tom="positivo">Dados salvos.</Aviso> : null}

          <Botao onClick={() => void salvar()} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar alterações"}
          </Botao>
        </div>
      </Cartao>

      <Cartao className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-stroke-list px-4 py-3">
          <h3 className="text-[14px] leading-5 font-bold text-ink-heading">
            Situação da produção
          </h3>
          {/*
            O estado vira etiqueta, não caixa de aviso. "Esta é a peça atual"
            ocupava a largura inteira num quadro de alerta, e não é alerta
            nenhum: é o estado normal de uma das dezoito peças.
          */}
          {peca.status === "concluida" ? (
            <Tag tom="positivo">Concluída</Tag>
          ) : peca.atual ? (
            <Tag tom="areia">Peça atual</Tag>
          ) : (
            <Tag>Fora de cartaz</Tag>
          )}
        </div>

        <div className="space-y-3.5 px-4 py-4">
          {peca.status === "concluida" ? (
            <p className="text-[13px] leading-5 text-ink-body">
              As participações de quem estava escalado já foram registradas no histórico de cada
              um.
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-ink-caption">
                {peca.atual
                  ? "É esta que os participantes veem ao abrir o app, com personagem, roteiro e ensaios."
                  : "Somente uma peça é a peça atual. Ao definir esta, a anterior deixa de ser."}
              </p>
              {peca.atual ? null : (
                <Botao variante="ghost" onClick={() => void tornarAtual()} disabled={enviando}>
                  Definir como peça atual
                </Botao>
              )}

              <Divisor />

              {/*
                O número entra na frase. "Registra a participação de cada pessoa
                escalada" não dizia quantas são, e é justamente o que a direção
                precisa saber antes de apertar um botão que escreve histórico.
              */}
              <p className="text-[13px] leading-5 text-ink-caption">
                Concluir retira a peça de cartaz e registra a participação{" "}
                {escalados === 0
                  ? "de quem estiver escalado — hoje, ninguém."
                  : `de ${pluralizar(escalados, "pessoa escalada", "pessoas escaladas")} no histórico delas.`}
              </p>
              <Botao variante="ghost" onClick={() => setConfirmando(true)} disabled={enviando}>
                Concluir peça
              </Botao>
            </>
          )}
        </div>
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
