"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDots, CaretRight, Certificate, Scroll } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import {
  buscarPecaAtual,
  buscarPersonagemDaPessoa,
  listarEnsaios,
  listarFalasDoPersonagem,
  listarParticipacoes,
} from "@/lib/db";
import {
  dataLonga,
  diaDoMes,
  diaSemanaEHorario,
  hojeISO,
  mesCurto,
  primeiroNome,
} from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import {
  PLAY_STATUS_LABEL,
  ROLE_TYPE_LABEL,
  type Character,
  type Play,
  type Rehearsal,
} from "@/lib/types";
import { ErroCarregamento, TopoInicio } from "@/components/shell";
import { StatusEnsaio } from "@/components/comum/ensaio-cartao";
import { ConfirmarPresenca } from "@/components/comum/presenca";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import {
  BlocoData,
  BotaoLink,
  Cartao,
  Carregando,
  Divisor,
  Eyebrow,
  Status,
  Tag,
  Vazio,
} from "@/components/ui";

/** Saudação pelo horário local, como no design ("Boa noite,"). */
function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const TOM_PECA = {
  planejamento: "neutro",
  escalacao: "aviso",
  ensaio: "aviso",
  pronta: "info",
  concluida: "positivo",
  arquivada: "neutro",
} as const;

interface TelaInicio {
  peca: Play | null;
  personagem: Character | null;
  ensaios: Rehearsal[];
  pecas: number;
  falas: number;
}

export default function Inicio() {
  const { conta, pessoa } = useAuth();

  /*
   * Um carregamento só, em três passos, em vez de quatro consultas
   * encadeadas: a peça e o histórico saem juntos; depois o personagem e os
   * ensaios; e por fim as falas — filtradas pelo personagem, para não baixar
   * o roteiro inteiro só para mostrar um contador.
   */
  const tela = useCarregar<TelaInicio>("inicio", async () => {
    const vazio: TelaInicio = {
      peca: null,
      personagem: null,
      ensaios: [],
      pecas: 0,
      falas: 0,
    };
    if (!pessoa) return vazio;

    const [peca, participacoes] = await Promise.all([
      buscarPecaAtual(),
      listarParticipacoes(pessoa.id),
    ]);
    if (!peca) return { ...vazio, pecas: participacoes.length };

    const [personagem, ensaios] = await Promise.all([
      buscarPersonagemDaPessoa(peca.id, pessoa.id),
      listarEnsaios(peca.id),
    ]);

    const minhas = personagem
      ? await listarFalasDoPersonagem(peca.id, personagem.id)
      : [];

    return {
      peca,
      personagem,
      ensaios,
      pecas: participacoes.length,
      falas: minhas.filter((f) => f.tipo === "fala").length,
    };
  }, [pessoa?.id]);

  const peca = tela.dados?.peca ?? null;
  const personagem = tela.dados?.personagem ?? null;

  const proximo = useMemo(() => {
    const hoje = hojeISO();
    return (
      (tela.dados?.ensaios ?? []).find(
        (e) =>
          e.data >= hoje &&
          e.status !== "cancelado" &&
          e.status !== "concluido" &&
          (e.todos || (pessoa ? e.convocados.includes(pessoa.id) : false)),
      ) ?? null
    );
  }, [tela.dados, pessoa]);

  const nome = pessoa?.nome ?? conta?.nome ?? "";

  return (
    <div>
      <TopoInicio saudacao={saudacao()} nome={primeiroNome(nome)} />

      {!pessoa ? (
        <SemVinculo />
      ) : tela.carregando ? (
        <Carregando />
      ) : tela.erro ? (
        <ErroCarregamento erro={tela.erro} onTentarNovamente={tela.recarregar} />
      ) : !peca ? (
        <Vazio
          titulo="Nenhuma peça em andamento"
          descricao="A direção ainda não definiu a peça atual. Seu histórico de participações continua disponível."
          acao={
            <BotaoLink href="/historico" variante="ghost">
              Ver meu histórico
            </BotaoLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Peça atual + personagem */}
          {personagem ? (
            <Cartao className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <Eyebrow>Peça atual</Eyebrow>
                <Status tom={TOM_PECA[peca.status]}>{PLAY_STATUS_LABEL[peca.status]}</Status>
              </div>
              <h2 className="mt-1.5 text-[24px] leading-7 font-bold text-ink-heading">
                {peca.titulo}
              </h2>
              {peca.dataApresentacao || peca.local ? (
                <p className="mt-1 text-[13px] leading-5 text-ink-caption">
                  {[
                    peca.dataApresentacao ? `Apresentação em ${dataLonga(peca.dataApresentacao)}` : null,
                    peca.local || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              <Divisor className="my-3.5" />

              <Eyebrow>Seu personagem</Eyebrow>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <h3 className="text-[20px] leading-6 font-bold text-ink-heading">
                  {personagem.nome}
                </h3>
                <Tag tom="areia">{ROLE_TYPE_LABEL[personagem.tipoPapel]}</Tag>
              </div>
              {personagem.descricao ? (
                <p className="mt-2 text-[14px] leading-[21px] text-ink-body">
                  {personagem.descricao}
                </p>
              ) : null}

              <div className="mt-3.5">
                <BotaoLink href="/personagem" variante="ghost" larguraTotal className="gap-1.5">
                  Ver meu personagem
                  <CaretRight size={15} />
                </BotaoLink>
              </div>
            </Cartao>
          ) : (
            <Cartao className="relative overflow-hidden px-4 py-5 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/alianca-mark-cream.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -top-3 -right-5 w-28 opacity-[0.06]"
              />
              <p className="relative text-[24px] leading-7 font-bold text-ink-heading">
                Nos vemos na próxima peça!
              </p>
              <p className="relative mx-auto mt-2 max-w-xs text-[14px] leading-[21px] text-ink-body">
                Você não está escalado em <strong>{peca.titulo}</strong>. Seu histórico continua
                disponível.
              </p>
              <div className="relative mt-4 flex justify-center">
                <BotaoLink href="/historico" variante="ghost">
                  Ver meu histórico
                </BotaoLink>
              </div>
            </Cartao>
          )}

          {/* Próximo ensaio */}
          <Cartao className="bg-surface-raised px-4 py-3.5">
            {tela.atualizando ? (
              <p className="text-[13px] text-ink-caption">Carregando ensaios…</p>
            ) : !proximo ? (
              <>
                <Eyebrow>Próximo ensaio</Eyebrow>
                <p className="mt-1.5 text-[14px] leading-[21px] text-ink-body">
                  Nenhum ensaio agendado para você por enquanto.
                </p>
              </>
            ) : (
              <div className="flex items-start gap-3.5">
                <BlocoData dia={diaDoMes(proximo.data)} mes={mesCurto(proximo.data)} />
                <div className="min-w-0 flex-1">
                  <Eyebrow>Próximo ensaio</Eyebrow>
                  <p className="mt-1 text-[15px] leading-[22px] font-bold text-ink-heading">
                    {diaSemanaEHorario(proximo.data, proximo.horaInicio, proximo.horaFim)}
                  </p>
                  {proximo.local ? (
                    <p className="text-[13px] leading-5 text-ink-caption">{proximo.local}</p>
                  ) : null}
                  <div className="mt-1.5">
                    <StatusEnsaio status={proximo.status} />
                  </div>
                </div>
              </div>
            )}

            {proximo && proximo.status !== "cancelado" && proximo.status !== "concluido" ? (
              <>
                <Divisor className="my-3.5" />
                <ConfirmarPresenca ensaio={proximo} personId={pessoa.id} nome={pessoa.nome} />
              </>
            ) : null}
          </Cartao>

          {/* Atalhos */}
          <div className="grid grid-cols-2 gap-3">
            <Atalho
              href="/roteiro"
              rotulo="Roteiro"
              contador={
                !peca.roteiroPublicado
                  ? "não publicado"
                  : `${tela.dados?.falas ?? 0} ${(tela.dados?.falas ?? 0) === 1 ? "fala sua" : "falas suas"}`
              }
              destaque
            >
              <Scroll size={24} />
            </Atalho>
            <Atalho
              href="/historico"
              rotulo="Histórico"
              contador={
                `${tela.dados?.pecas ?? 0} ${(tela.dados?.pecas ?? 0) === 1 ? "peça" : "peças"}`
              }
            >
              <Certificate size={24} />
            </Atalho>
          </div>

          <Link
            href="/ensaios"
            className="flex items-center justify-between gap-2 rounded-[16px] border border-stroke-frame bg-surface-card px-4 py-3.5 text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
          >
            <span className="flex items-center gap-2.5">
              <CalendarDots size={20} className="text-ink-caption" />
              Todos os ensaios
            </span>
            <CaretRight size={15} className="text-ink-caption" />
          </Link>
        </div>
      )}
    </div>
  );
}

/** Atalho quadrado: ícone no topo, título e contador no pé. */
function Atalho({
  href,
  rotulo,
  contador,
  destaque = false,
  children,
}: {
  href: string;
  rotulo: string;
  contador: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[104px] flex-col justify-between rounded-[16px] border border-stroke-frame bg-surface-card px-4 py-3.5 transition-colors hover:bg-surface-hover"
    >
      <span className={destaque ? "text-brand" : "text-ink-body"}>{children}</span>
      <span>
        <span className="block text-[15px] leading-[22px] font-bold text-ink-heading">
          {rotulo}
        </span>
        <span className="block text-[12px] leading-[18px] text-ink-caption">{contador}</span>
      </span>
    </Link>
  );
}
