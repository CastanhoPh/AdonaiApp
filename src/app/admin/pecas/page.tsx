"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClockCounterClockwise, Plus } from "@phosphor-icons/react";
import { criarPeca, definirPecaAtual, listarPecas } from "@/lib/db";
import { ano, dataCurta, dataLonga, hojeISO, pluralizar } from "@/lib/format";
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
  Eyebrow,
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

  /*
   * Duas leituras diferentes, duas apresentações.
   *
   * Peça em produção é operacional: quem abre esta tela quer agir nela, então
   * vem em cartão, com capa e com o botão de definir como atual. Acervo é
   * consulta: dezessete cartões iguais viravam rolagem sem fim, e o que se
   * procura ali é "que peça foi em tal ano" — por isso linhas compactas
   * agrupadas por ano.
   */
  const emProducao = lista.filter((p) => p.status !== "concluida" && p.status !== "arquivada");
  const acervo = lista.filter((p) => p.status === "concluida" || p.status === "arquivada");

  const porAno = Array.from(
    acervo.reduce((mapa, peca) => {
      const chave = ano(peca.dataApresentacao);
      mapa.set(chave, [...(mapa.get(chave) ?? []), peca]);
      return mapa;
    }, new Map<string, Play[]>()),
  ).sort((a, b) => b[0].localeCompare(a[0]));

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
        // A capa entra depois, na aba Dados da peça.
        capaUrl: "",
        capaMiniUrl: "",
        dataApresentacao: form.dataApresentacao,
        local: form.local.trim(),
        status: form.status,
        atual: form.atual,
      });
      await pecas.recarregar();
    });
    if (ok) setAbertoManual(false);
  }

  /** Põe ou tira de cartaz, sem mexer nas outras peças. */
  async function alternarCartaz(peca: Play) {
    await enviar(async () => {
      await definirPecaAtual(peca.id, !peca.atual);
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
              <>
                {emProducao.length > 0 ? (
                  <section>
                    <Eyebrow>Em produção</Eyebrow>
                    <ul className="mt-2 space-y-3">
                      {emProducao.map((peca) => (
                        <CartaoDeProducao
                          key={peca.id}
                          peca={peca}
                          enviando={enviando}
                          onAlternarCartaz={() => void alternarCartaz(peca)}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}

                {porAno.map(([anoDaPeca, doAno]) => (
                  <section key={anoDaPeca}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-stroke-frame pb-1.5">
                      <p className="fonte-num text-[15px] leading-6 font-bold text-ink-heading">
                        {anoDaPeca}
                      </p>
                      <span className="text-[12px] leading-[18px] text-ink-caption">
                        {pluralizar(doAno.length, "peça", "peças")}
                      </span>
                    </div>
                    <ul>
                      {doAno.map((peca) => (
                        <LinhaDoAcervo key={peca.id} peca={peca} />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
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

/**
 * Peça em produção: cartão com capa e a ação de definir como atual.
 *
 * Mantém a apresentação em cartão porque aqui se age, não se consulta — e
 * porque em produção há sempre uma ou duas peças, não dezessete.
 */
function CartaoDeProducao({
  peca,
  enviando,
  onAlternarCartaz,
}: {
  peca: Play;
  enviando: boolean;
  onAlternarCartaz: () => void;
}) {
  return (
    <li>
      <Cartao className={juntar("px-4 py-4", peca.atual && "border-brand")}>
        <div className="flex items-start gap-3.5">
          {/*
            * Sem capa, sem moldura vazia: o quadrado com ícone de peça
            * ocupava 64px para não dizer nada, e a maioria das peças não tem
            * capa cadastrada.
            */}
          {peca.capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              // A pequena quando existe. As peças com capa antiga não têm, e
              // aí cai na grande — que é pesada, mas melhor que quadrado vazio.
              src={peca.capaMiniUrl || peca.capaUrl}
              alt={peca.titulo}
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              className="size-16 shrink-0 rounded-[8px] border border-stroke-frame object-cover"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/admin/pecas/detalhe?id=${peca.id}`}
                className="text-[15px] leading-[22px] font-bold text-ink-heading hover:text-brand-strong"
              >
                {peca.titulo}
              </Link>
              {peca.atual ? <Tag tom="areia">Em cartaz</Tag> : null}
            </div>

            <p className="mt-0.5 text-[13px] leading-5 text-ink-caption">
              {[
                peca.nomeEvento || null,
                peca.dataApresentacao ? dataLonga(peca.dataApresentacao) : null,
                peca.local || null,
              ]
                .filter(Boolean)
                .join(" · ") || "Sem data definida"}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Status tom={TOM_STATUS[peca.status]}>{PLAY_STATUS_LABEL[peca.status]}</Status>
              <Tag tom={peca.elencoFechado ? "neutro" : "areia"}>
                {peca.elencoFechado ? "Elenco fechado" : "Elenco em aberto"}
              </Tag>
              {peca.roteiroPublicado ? (
                <Tag tom="positivo">Roteiro v{peca.roteiroVersao}</Tag>
              ) : peca.roteiroEditadoEm ? (
                <Tag>Roteiro em edição</Tag>
              ) : null}
            </div>

            {/*
              * Pôr e tirar de cartaz, sem mexer nas outras.
              *
              * Antes marcar uma peça desmarcava todas as demais, e não havia
              * como tirar de cartaz a não ser marcando outra. Com duas
              * produções em paralelo — Natal e Páscoa é o normal —, isso
              * obrigava a escolher qual metade do elenco ficava sem ver o
              * próprio roteiro.
              */}
            <div className="mt-3">
              <Botao variante="ghost" onClick={onAlternarCartaz} disabled={enviando}>
                {peca.atual ? "Tirar de cartaz" : "Pôr em cartaz"}
              </Botao>
            </div>
          </div>
        </div>
      </Cartao>
    </li>
  );
}

/**
 * Uma peça do acervo, em linha.
 *
 * Só o que distingue uma peça da outra: dia, título e evento. Status ficou de
 * fora porque no acervo é "Concluída" em todas, e "Sem roteiro" também — repetir
 * dezessete vezes o que não varia é ruído, não informação. Elenco em aberto
 * aparece porque é o que ainda pede trabalho; fechado fica implícito.
 */
function LinhaDoAcervo({ peca }: { peca: Play }) {
  return (
    <li className="border-b border-stroke-list last:border-0">
      <Link
        href={`/admin/pecas/detalhe?id=${peca.id}`}
        className="-mx-2 flex items-baseline gap-3 rounded-[8px] px-2 py-2.5 transition-colors hover:bg-surface-hover"
      >
        <span className="fonte-num w-11 shrink-0 text-[12px] leading-5 text-ink-caption">
          {peca.dataApresentacao ? dataCurta(peca.dataApresentacao) : "--/--"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-ink-heading">
          {peca.titulo}
        </span>
        <span className="hidden min-w-0 max-w-[42%] shrink truncate text-[12px] leading-5 text-ink-caption min-[560px]:block">
          {peca.nomeEvento ?? ""}
        </span>
        {!peca.elencoFechado ? (
          <Tag tom="areia" className="shrink-0">
            Elenco em aberto
          </Tag>
        ) : null}
        {peca.status === "arquivada" ? <Tag className="shrink-0">Arquivada</Tag> : null}
      </Link>
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
