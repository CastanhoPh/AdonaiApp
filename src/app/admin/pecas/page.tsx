"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, ClockCounterClockwise, PuzzlePiece, Plus } from "@phosphor-icons/react";
import { criarPeca, definirPecaAtual, listarPecas } from "@/lib/db";
import { dataLonga, hojeISO } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import { PLAY_STATUS, PLAY_STATUS_LABEL, type Play, type PlayStatus } from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoLink,
  Caixa,
  Campo,
  Cartao,
  Carregando,
  Entrada,
  Modal,
  Selecao,
  Status,
  Tag,
  Vazio,
  juntar,
} from "@/components/ui";

function pecaVazia() {
  return {
    titulo: "",
    nomeEvento: "",
    descricao: "",
    dataApresentacao: "",
    local: "",
    status: "planejamento" as PlayStatus,
    atual: false,
  };
}

const TOM_STATUS: Record<PlayStatus, "neutro" | "info" | "positivo" | "aviso"> = {
  planejamento: "neutro",
  escalacao: "aviso",
  ensaio: "aviso",
  pronta: "info",
  concluida: "positivo",
  arquivada: "neutro",
};

export default function Pecas() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      }
    >
      <ConteudoPecas />
    </Suspense>
  );
}

function ConteudoPecas() {
  const consulta = useSearchParams();
  const pecas = useCarregar<Play[]>("admin-pecas", () => listarPecas(), []);
  const { enviando, erro, definirErro, enviar } = useEnvio();

  /*
   * `?novo=1` já chega com o formulário aberto. O atalho "Nova peça" do Painel
   * apenas trazia até esta lista, e era preciso clicar no mesmo botão de novo —
   * parecia que o app tinha ido para outra tela em vez de fazer o que se pediu.
   *
   * O estado é derivado do parâmetro, não copiado na montagem: na exportação
   * estática `useSearchParams` pode vir vazio no primeiro render, e um valor
   * inicial de `useState` perderia o pedido. `null` significa "ninguém mexeu
   * ainda", então quem decide é a URL; depois do primeiro toque, a escolha da
   * pessoa manda.
   */
  const [abertoManual, setAbertoManual] = useState<boolean | null>(null);
  const aberto = abertoManual ?? consulta.get("novo") === "1";
  const [form, setForm] = useState(pecaVazia());

  const lista = pecas.dados ?? [];
  const ativas = lista.filter((p) => p.status !== "arquivada");
  const arquivadas = lista.filter((p) => p.status === "arquivada");

  function abrir() {
    setForm(pecaVazia());
    definirErro(null);
    setAbertoManual(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) {
      definirErro("Informe o título da peça.");
      return;
    }
    const ok = await enviar(async () => {
      await criarPeca({
        titulo: form.titulo.trim(),
        nomeEvento: form.nomeEvento.trim(),
        descricao: form.descricao.trim(),
        capaUrl: "",
        dataApresentacao: form.dataApresentacao,
        local: form.local.trim(),
        status: form.status,
        atual: form.atual,
      });
      await pecas.recarregar();
    });
    if (ok) setAbertoManual(false);
  }

  async function marcarComoAtual(id: string) {
    await enviar(async () => {
      await definirPecaAtual(id);
      await pecas.recarregar();
    });
  }

  return (
    <>
      <TopoAdmin
        titulo="Peças"
        subtitulo="Cada peça reúne personagens, elenco, roteiro e ensaios."
        acoes={
          <>
            {/* Peça antiga tem caminho próprio: nasce concluída, sem ensaio nem roteiro. */}
            <BotaoLink href="/admin/pecas/antiga" variante="ghost" className="gap-1.5">
              <ClockCounterClockwise size={15} />
              Registrar peça antiga
            </BotaoLink>
            <Botao onClick={abrir} className="gap-1.5">
              <Plus size={15} />
              Nova peça
            </Botao>
          </>
        }
      />

      <CorpoAdmin>
        {pecas.carregando ? (
          <Carregando />
        ) : pecas.erro ? (
          <ErroCarregamento erro={pecas.erro} onTentarNovamente={pecas.recarregar} />
        ) : (
          <div className="space-y-4">
            {erro && !aberto ? <Aviso>{erro}</Aviso> : null}

            {lista.length === 0 ? (
              <Vazio
                titulo="Nenhuma peça cadastrada"
                descricao="Crie a primeira peça para começar a montar o elenco e o roteiro."
                acao={<Botao onClick={abrir}>Nova peça</Botao>}
              />
            ) : (
              <ul className="space-y-3">
                {ativas.map((peca) => (
                  <ItemPeca
                    key={peca.id}
                    peca={peca}
                    enviando={enviando}
                    onMarcarAtual={() => void marcarComoAtual(peca.id)}
                  />
                ))}
              </ul>
            )}

            {arquivadas.length > 0 ? (
              <section className="pt-2">
                <p className="eyebrow mb-3 text-ink-caption">Arquivadas</p>
                <ul className="space-y-3">
                  {arquivadas.map((peca) => (
                    <ItemPeca
                      key={peca.id}
                      peca={peca}
                      enviando={enviando}
                      onMarcarAtual={() => void marcarComoAtual(peca.id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </CorpoAdmin>

      <FormularioNovaPeca
        aberto={aberto}
        onFechar={() => setAbertoManual(false)}
        enviando={enviando}
        erro={erro}
        form={form}
        setForm={setForm}
        onSalvar={() => void salvar()}
      />
    </>
  );
}

function ItemPeca({
  peca,
  enviando,
  onMarcarAtual,
}: {
  peca: Play;
  enviando: boolean;
  onMarcarAtual: () => void;
}) {
  return (
    <li>
      <Cartao className={juntar("px-4 py-4", peca.atual && "border-brand")}>
        <div className="flex items-start gap-3.5">
          {peca.capaUrl ? (
            // Capa cadastrada pela direção (Storage ou URL externa).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={peca.capaUrl}
              alt={peca.titulo}
              className="size-16 shrink-0 rounded-[8px] border border-stroke-frame object-cover"
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-[8px] border border-stroke-frame bg-surface-raised text-ink-caption">
              <PuzzlePiece size={26} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/admin/pecas/detalhe?id=${peca.id}`}
                className="inline-flex items-center gap-1.5 text-[15px] leading-[22px] font-bold text-ink-heading hover:text-brand-strong"
              >
                {peca.titulo}
                <ArrowUpRight size={14} />
              </Link>
              {peca.atual ? <Tag tom="areia">Peça atual</Tag> : null}
            </div>

            {peca.descricao ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-caption">
                {peca.descricao}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Status tom={TOM_STATUS[peca.status]}>{PLAY_STATUS_LABEL[peca.status]}</Status>
              {/* Responde "ainda dá para entrar nessa peça?", que o status não responde. */}
              <Tag tom={peca.elencoFechado ? "neutro" : "areia"}>
                {peca.elencoFechado ? "Elenco fechado" : "Elenco em aberto"}
              </Tag>
              {peca.dataApresentacao ? (
                <span className="text-[12px] leading-[18px] text-ink-caption">
                  {dataLonga(peca.dataApresentacao)}
                  {peca.local ? ` · ${peca.local}` : ""}
                </span>
              ) : null}
              {/*
                * "Em edição" só cabe quando alguém mexeu no roteiro. Peça do
                * acervo nunca teve texto no app, e dizer que está em edição
                * sugere trabalho em andamento que não existe.
                */}
              <Tag tom={peca.roteiroPublicado ? "positivo" : "neutro"}>
                {peca.roteiroPublicado
                  ? `Roteiro v${peca.roteiroVersao}`
                  : peca.roteiroEditadoEm
                    ? "Roteiro em edição"
                    : "Sem roteiro"}
              </Tag>
            </div>

            {!peca.atual && peca.status !== "concluida" && peca.status !== "arquivada" ? (
              <div className="mt-3">
                <Botao variante="ghost" onClick={onMarcarAtual} disabled={enviando}>
                  Definir como peça atual
                </Botao>
              </div>
            ) : null}
          </div>
        </div>
      </Cartao>
    </li>
  );
}

/** Formulário de nova peça. */
function FormularioNovaPeca({
  aberto,
  onFechar,
  enviando,
  erro,
  form,
  setForm,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  enviando: boolean;
  erro: string | null;
  form: ReturnType<typeof pecaVazia>;
  setForm: (valor: ReturnType<typeof pecaVazia>) => void;
  onSalvar: () => void;
}) {
  return (
    <Modal
      titulo="Nova peça"
      aberto={aberto}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="bare" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={onSalvar} disabled={enviando}>
            {enviando ? "Criando…" : "Criar peça"}
          </Botao>
        </>
      }
    >
      <div className="space-y-3.5">
        <Campo etiqueta="Título" obrigatorio>
          <Entrada
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: O Filho Pródigo"
          />
        </Campo>
        <Campo etiqueta="Nome do evento" dica="Opcional. Ex.: Congresso de Jovens 2026.">
          <Entrada
            value={form.nomeEvento}
            onChange={(e) => setForm({ ...form, nomeEvento: e.target.value })}
            placeholder="Evento em que será apresentada"
          />
        </Campo>
        <Campo etiqueta="Descrição">
          <AreaTexto
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Resumo da peça, tema e proposta."
          />
        </Campo>
        {/* A capa mora em pecas/{playId}/, e o id nasce com o Salvar. */}
        <p className="text-[12px] leading-[18px] text-ink-caption">
          A capa é enviada depois de salvar, na aba Dados da peça.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Data da apresentação">
            <Entrada
              type="date"
              value={form.dataApresentacao}
              min={hojeISO()}
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
        <div className="-mx-2">
          <Caixa
            marcada={form.atual}
            onClick={() => setForm({ ...form, atual: !form.atual })}
            descricao="Somente uma peça é a atual. Ao marcar esta, a anterior deixa de ser."
          >
            Definir como peça atual
          </Caixa>
        </div>
        {erro ? <Aviso>{erro}</Aviso> : null}
      </div>
    </Modal>
  );
}
