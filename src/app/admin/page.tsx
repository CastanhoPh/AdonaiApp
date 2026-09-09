"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "@phosphor-icons/react";
import {
  buscarPecaAtual,
  listarEnsaios,
  listarFalas,
  listarPersonagens,
  listarPessoas,
} from "@/lib/db";
import { dataLonga, diaDoMes, diaSemana, faixaHoraria, hojeISO, mesCurto } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import {
  PLAY_STATUS_LABEL,
  ROLE_TYPE_LABEL,
  type Character,
  type Play,
  type Rehearsal,
} from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import {
  BlocoData,
  Botao,
  BotaoLink,
  Cartao,
  Carregando,
  Eyebrow,
  Indicador,
  Status,
  TituloSecao,
  Vazio,
} from "@/components/ui";

interface Resumo {
  peca: Play | null;
  personagens: Character[];
  ensaios: Rehearsal[];
  falas: number;
  pessoasAtivas: number;
  pessoasInativas: number;
}

export default function Painel() {
  const resumo = useCarregar<Resumo>("admin-painel", async () => {
    const [peca, pessoas] = await Promise.all([buscarPecaAtual(), listarPessoas()]);
    const [personagens, ensaios, falas] = peca
      ? await Promise.all([listarPersonagens(peca.id), listarEnsaios(peca.id), listarFalas(peca.id)])
      : [[], [], []];
    return {
      peca,
      personagens,
      ensaios,
      falas: falas.length,
      pessoasAtivas: pessoas.filter((p) => p.ativo).length,
      pessoasInativas: pessoas.filter((p) => !p.ativo).length,
    };
  }, []);

  const dados = resumo.dados;
  const peca = dados?.peca ?? null;
  const personagens = dados?.personagens ?? [];
  const semAtor = personagens.filter((p) => !p.personId);
  const escalados = personagens.filter((p) => p.personId);

  const hoje = hojeISO();
  const proximo =
    (dados?.ensaios ?? []).find(
      (e) => e.data >= hoje && e.status !== "cancelado" && e.status !== "concluido",
    ) ?? null;
  const convocados = proximo ? (proximo.todos ? escalados.length : proximo.convocados.length) : 0;

  return (
    <>
      <TopoAdmin
        titulo="Painel do teatro"
        subtitulo={
          peca
            ? [
                peca.titulo,
                peca.dataApresentacao ? `apresentação em ${dataLonga(peca.dataApresentacao)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Nenhuma peça atual definida"
        }
        acoes={
          <>
            <BotaoLink href="/admin/ensaios?novo=1" variante="ghost" className="gap-1.5">
              <Plus size={15} />
              Novo ensaio
            </BotaoLink>
            <BotaoLink href="/admin/pecas?novo=1" className="gap-1.5">
              <Plus size={15} />
              Nova peça
            </BotaoLink>
          </>
        }
      />

      <CorpoAdmin>
        {resumo.carregando ? (
          <Carregando />
        ) : resumo.erro ? (
          <ErroCarregamento erro={resumo.erro} onTentarNovamente={resumo.recarregar} />
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Indicador
                rotulo="Participantes ativos"
                valor={dados?.pessoasAtivas ?? 0}
                detalhe={`${dados?.pessoasInativas ?? 0} inativos`}
              />
              <Indicador
                rotulo="Personagens da peça"
                valor={personagens.length}
                detalhe={peca ? peca.titulo : "sem peça atual"}
              />
              <Indicador
                rotulo="Personagens sem ator"
                valor={semAtor.length}
                detalhe={semAtor.length === 0 ? "elenco completo" : "aguardando escalação"}
                alerta={semAtor.length > 0}
              />
              <Indicador
                rotulo="Convocados no próximo"
                valor={proximo ? convocados : "—"}
                detalhe={proximo ? diaSemana(proximo.data).toLowerCase() : "sem ensaio marcado"}
              />
            </div>

            {!peca ? (
              <Vazio
                titulo="Nenhuma peça atual definida"
                descricao="Crie uma peça e marque-a como atual para que os participantes vejam seus personagens, o roteiro e os ensaios."
                acao={<BotaoLink href="/admin/pecas">Gerenciar peças</BotaoLink>}
              />
            ) : (
              <div className="grid gap-4 min-[900px]:grid-cols-2">
                {/* Peça atual */}
                <Cartao className="px-4 py-4">
                  <TituloSecao
                    titulo="Peça atual"
                    acao={
                      <Link
                        href={`/admin/pecas/detalhe?id=${peca.id}`}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-strong hover:underline"
                      >
                        Abrir
                        <ArrowUpRight size={14} />
                      </Link>
                    }
                  />
                  <dl className="space-y-0">
                    <LinhaValor rotulo="Título" valor={peca.titulo} />
                    <LinhaValor
                      rotulo="Status"
                      valor={<Status tom="aviso">{PLAY_STATUS_LABEL[peca.status]}</Status>}
                    />
                    <LinhaValor
                      rotulo="Elenco definido"
                      valor={`${escalados.length} de ${personagens.length}`}
                    />
                    <LinhaValor
                      rotulo="Roteiro"
                      valor={
                        peca.roteiroPublicado
                          ? `versão ${peca.roteiroVersao} publicada`
                          : "não publicado"
                      }
                    />
                    <LinhaValor rotulo="Falas cadastradas" valor={String(dados?.falas ?? 0)} />
                    <LinhaValor
                      rotulo="Ensaios"
                      valor={String((dados?.ensaios ?? []).length)}
                      ultima
                    />
                  </dl>
                </Cartao>

                {/* Personagens sem ator */}
                <Cartao
                  className={semAtor.length > 0 ? "border-state-warning/60 px-4 py-4" : "px-4 py-4"}
                >
                  <TituloSecao
                    titulo="Personagens sem ator"
                    descricao={
                      semAtor.length === 0
                        ? "Todo o elenco está definido."
                        : "Escale o elenco para completar a produção."
                    }
                  />
                  {semAtor.length === 0 ? (
                    <p className="text-[13px] leading-5 text-ink-caption">
                      Nada pendente por aqui.
                    </p>
                  ) : (
                    <ul>
                      {semAtor.map((personagem, indice) => (
                        <li
                          key={personagem.id}
                          className={
                            indice === semAtor.length - 1
                              ? "flex items-center justify-between gap-3 py-2.5"
                              : "flex items-center justify-between gap-3 border-b border-stroke-list py-2.5"
                          }
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] leading-[21px] font-medium text-ink-heading">
                              {personagem.nome}
                            </p>
                            <p className="text-[12px] leading-[18px] text-ink-caption">
                              {ROLE_TYPE_LABEL[personagem.tipoPapel]}
                            </p>
                          </div>
                          <BotaoLink
                            href={`/admin/pecas/detalhe?id=${peca.id}&aba=elenco`}
                            variante="ghost"
                          >
                            Escalar
                          </BotaoLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </Cartao>
              </div>
            )}

            {/* Faixa do próximo ensaio */}
            {proximo ? (
              <Cartao className="bg-surface-raised px-4 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <BlocoData dia={diaDoMes(proximo.data)} mes={mesCurto(proximo.data)} />
                  <div className="min-w-0 flex-1">
                    <Eyebrow>Próximo ensaio</Eyebrow>
                    <p className="mt-1 text-[15px] leading-[22px] font-bold text-ink-heading">
                      {faixaHoraria(proximo.horaInicio, proximo.horaFim)}
                      {proximo.local ? ` · ${proximo.local}` : ""}
                    </p>
                    <p className="text-[13px] leading-5 text-ink-caption">
                      {convocados} convocados
                      {proximo.observacoes ? ` · ${proximo.observacoes}` : ""}
                    </p>
                  </div>
                  <BotaoLink href={`/admin/ensaios?abrir=${proximo.id}`} variante="ghost">
                    Abrir ensaio
                  </BotaoLink>
                </div>
              </Cartao>
            ) : peca ? (
              <Cartao className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <p className="text-[13px] leading-5 text-ink-caption">
                  Nenhum ensaio agendado para esta peça.
                </p>
                <BotaoLink href="/admin/ensaios?novo=1" variante="ghost">
                  Marcar ensaio
                </BotaoLink>
              </Cartao>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <BotaoLink href="/admin/pessoas" variante="ghost">
                Pessoas
              </BotaoLink>
              {peca ? (
                <>
                  <BotaoLink href={`/admin/pecas/detalhe?id=${peca.id}&aba=elenco`} variante="ghost">
                    Elenco
                  </BotaoLink>
                  <BotaoLink href={`/admin/pecas/detalhe?id=${peca.id}&aba=roteiro`} variante="ghost">
                    Editor de roteiro
                  </BotaoLink>
                </>
              ) : null}
              <Botao variante="bare" onClick={() => void resumo.recarregar()}>
                Atualizar
              </Botao>
            </div>
          </div>
        )}
      </CorpoAdmin>
    </>
  );
}

/** Linha rótulo/valor dos painéis, separada por stroke-list. */
function LinhaValor({
  rotulo,
  valor,
  ultima = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  ultima?: boolean;
}) {
  return (
    <div
      className={
        ultima
          ? "flex items-center justify-between gap-3 py-2.5"
          : "flex items-center justify-between gap-3 border-b border-stroke-list py-2.5"
      }
    >
      <dt className="text-[13px] leading-5 text-ink-caption">{rotulo}</dt>
      <dd className="min-w-0 truncate text-[14px] leading-[21px] font-medium text-ink-heading">
        {valor}
      </dd>
    </div>
  );
}
