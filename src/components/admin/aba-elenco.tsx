"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle, MagnifyingGlass, UserMinus } from "@phosphor-icons/react";
import { atualizarPersonagem, escalarPessoa } from "@/lib/db";
import { nomeCurto, normalizar } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import { ROLE_TYPE_LABEL, type Character, type Person, type Trait } from "@/lib/types";
import {
  Avatar,
  Aviso,
  Botao,
  BotaoIcone,
  Cartao,
  Entrada,
  Status,
  Tag,
  TituloSecao,
  Vazio,
  juntar,
} from "@/components/ui";

/**
 * Montagem do elenco em duas colunas: à esquerda os personagens da peça, à
 * direita os candidatos sugeridos para o personagem em foco. A sugestão
 * compara as características da pessoa com as desejadas do papel.
 */
interface Candidato {
  pessoa: Person;
  /** Características desejadas que a pessoa atende. */
  atende: string[];
  cobreTudo: boolean;
  /** Nome do personagem em que ela já está escalada nesta peça, se houver. */
  jaEscaladaEm: string | null;
}

function listarCandidatos(
  personagemFoco: Character | null,
  pessoas: Person[],
  personagens: Character[],
): Candidato[] {
  if (!personagemFoco) return [];
  const desejadas = personagemFoco.caracteristicasDesejadas ?? [];
  const escaladaEm = new Map<string, string>();
  personagens.forEach((p) => {
    if (p.personId && p.id !== personagemFoco.id) escaladaEm.set(p.personId, p.nome);
  });

  /*
   * Todo o cadastro entra, não só quem está ativo.
   *
   * "Ativa no grupo" passa a significar "tem acesso ao app", e quem entrou pelo
   * acervo entra sem conta — inativo. Filtrar por ativo aqui reduzia os
   * candidatos de 42 para 4 e tornava impossível escalar quem o app conhece
   * mas ainda não tem acesso, que é a maioria do grupo.
   *
   * Inativo vai para o fim da lista e leva marca própria: continua disponível,
   * mas não é a primeira sugestão.
   */
  return pessoas
    .map((pessoa) => {
      const atende = desejadas.filter((id) => pessoa.caracteristicas?.includes(id));
      return {
        pessoa,
        atende,
        cobreTudo: desejadas.length > 0 && atende.length === desejadas.length,
        jaEscaladaEm: escaladaEm.get(pessoa.id) ?? null,
      };
    })
    .sort((a, b) => {
      // Ativo primeiro: é quem a direção alcança hoje pelo app.
      const ativoA = a.pessoa.ativo !== false;
      const ativoB = b.pessoa.ativo !== false;
      if (ativoA !== ativoB) return ativoA ? -1 : 1;
      if (a.atende.length !== b.atende.length) return b.atende.length - a.atende.length;
      if (Boolean(a.jaEscaladaEm) !== Boolean(b.jaEscaladaEm)) return a.jaEscaladaEm ? 1 : -1;
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
}

export function AbaElenco({
  playId,
  personagens,
  pessoas,
  caracteristicas,
  falasPorPersonagem,
  onAtualizar,
}: {
  playId: string;
  personagens: Character[];
  pessoas: Person[];
  caracteristicas: Trait[];
  falasPorPersonagem: Map<string, number>;
  onAtualizar: () => Promise<void>;
}) {
  const { enviando, erro, enviar } = useEnvio();
  const [emFoco, setEmFoco] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  /*
   * No celular as duas colunas viram uma, e a lista de personagens é alta: numa
   * peça de treze papéis o painel do escolhido nasce abaixo da dobra. Tocar num
   * personagem e não ver nada acontecer é o pior resultado possível aqui, então
   * a escolha leva a tela até o painel. No computador as duas colunas estão
   * lado a lado e rolar seria atrapalhar.
   */
  const painel = useRef<HTMLDivElement>(null);
  function escolher(id: string) {
    setEmFoco(id);
    if (window.matchMedia("(max-width: 899px)").matches) {
      painel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const nomeTrait = useMemo(
    () => new Map(caracteristicas.map((t) => [t.id, t.nome])),
    [caracteristicas],
  );
  const porId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  const pendentes = personagens.filter((p) => !p.personId);
  const escalados = personagens.filter((p) => p.personId);

  // Sem escolha explícita, o foco vai para o primeiro personagem sem ator.
  const personagemFoco =
    personagens.find((p) => p.id === emFoco) ?? pendentes[0] ?? personagens[0] ?? null;

  /**
   * Pessoas ativas ordenadas por aderência às características do papel. Sem
   * memoização: o elenco de um teatro de igreja tem dezenas de nomes, e
   * `personagemFoco` muda de identidade a cada render.
   */
  const candidatos = listarCandidatos(personagemFoco, pessoas, personagens);
  /*
   * A lista mostra as 8 primeiras sugestões, senão o cartão vira uma rolagem do
   * cadastro inteiro. Só que 8 de 42 deixava a maioria fora de alcance — e
   * ainda mais depois que quem entrou pelo acervo passou a ficar no fim da
   * ordenação. A busca pelo nome é o caminho para chegar em qualquer um.
   */
  const encontrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return candidatos;
    return candidatos.filter((c) => normalizar(c.pessoa.nome).includes(termo));
  }, [candidatos, busca]);
  const visiveis = encontrados.slice(0, 8);

  async function escalar(personagem: Character, personId: string | null) {
    const pessoa = personId ? porId.get(personId) : null;
    await enviar(async () => {
      await escalarPessoa(playId, personagem.id, personId, pessoa?.nome ?? "");
      await onAtualizar();
    });
  }

  async function alternarSituacao(personagem: Character) {
    await enviar(async () => {
      await atualizarPersonagem(playId, personagem.id, {
        situacao: personagem.situacao === "confirmado" ? "pendente" : "confirmado",
      });
      await onAtualizar();
    });
  }

  /** Confirma todos os personagens que já têm alguém escalado. */
  async function confirmarElenco() {
    await enviar(async () => {
      for (const personagem of personagens) {
        if (personagem.personId && personagem.situacao !== "confirmado") {
          await atualizarPersonagem(playId, personagem.id, { situacao: "confirmado" });
        }
      }
      await onAtualizar();
    });
  }

  if (personagens.length === 0) {
    return (
      <Vazio
        titulo="Cadastre os personagens primeiro"
        descricao="A escalação acontece depois que os personagens da peça estiverem criados."
      />
    );
  }

  const aConfirmar = escalados.filter((p) => p.situacao !== "confirmado").length;

  return (
    <div>
      <TituloSecao
        titulo="Elenco"
        descricao={`${escalados.length} de ${personagens.length} personagens escalados.`}
        acao={
          aConfirmar > 0 ? (
            <Botao onClick={() => void confirmarElenco()} disabled={enviando} className="gap-1.5">
              <CheckCircle size={15} />
              Confirmar elenco
            </Botao>
          ) : undefined
        }
      />

      {erro ? (
        <div className="mb-3">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      {/*
        Duas colunas com papéis distintos: à esquerda a lista para escolher, à
        direita tudo sobre o personagem escolhido.
        Antes as ações do personagem abriam dentro da própria linha da lista, o
        que empurrava os itens de baixo a cada clique — a lista se mexia
        justamente enquanto a direção estava mirando nela.
      */}
      <div className="grid items-start gap-4 min-[900px]:grid-cols-2">
        <Cartao className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-stroke-list px-4 py-3">
            <h3 className="text-[14px] leading-5 font-bold text-ink-heading">Personagens</h3>
            {pendentes.length > 0 ? (
              <Tag tom="aviso">{pendentes.length} sem ator</Tag>
            ) : (
              <Status tom="positivo">Elenco completo</Status>
            )}
          </div>

          <ul>
            {personagens.map((personagem) => {
              const foco = personagem.id === personagemFoco?.id;
              const ator = personagem.personId ? porId.get(personagem.personId) : null;
              const pendente = Boolean(personagem.personId) && personagem.situacao !== "confirmado";
              return (
                <li key={personagem.id}>
                  <button
                    type="button"
                    onClick={() => escolher(personagem.id)}
                    className={juntar(
                      "flex w-full items-center gap-3 border-b border-l-2 border-b-stroke-list px-3.5 py-2.5 text-left transition-colors last:border-b-0",
                      foco
                        ? "border-l-brand bg-brand/12"
                        : "border-l-transparent hover:bg-surface-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[14px] leading-[21px] font-medium text-ink-heading">
                          {personagem.nome}
                        </span>
                        {/*
                          O ponto âmbar só aparece quando há o que resolver.
                          Antes cada linha carregava a etiqueta "Confirmado",
                          que é o estado normal de quase todas — oito
                          repetições da mesma informação escondiam justamente a
                          linha diferente.
                        */}
                        {pendente ? (
                          <span
                            aria-label="Escalação pendente"
                            className="size-1.5 shrink-0 rounded-full bg-state-warning"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-[11.5px] leading-4 text-ink-caption">
                        {ROLE_TYPE_LABEL[personagem.tipoPapel]}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      {ator ? (
                        <>
                          <Avatar nome={ator.nome} url={ator.fotoUrl} tamanho={28} />
                          <span className="max-w-[150px] truncate text-[13px] leading-5 text-ink-body">
                            {nomeCurto(ator.nome)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[12px] leading-[18px] text-state-warning">
                          Sem ator
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Cartao>

        {/*
          O painel do personagem em foco. Fica fixo na rolagem porque a lista
          ao lado passa da altura dele quando a peça tem muitos papéis.
        */}
        <div
          ref={painel}
          className="scroll-mt-20 min-[900px]:sticky min-[900px]:top-4"
        >
          <Cartao className="overflow-hidden">
            {!personagemFoco ? (
              <p className="px-4 py-4 text-[13px] text-ink-caption">
                Escolha um personagem à esquerda.
              </p>
            ) : (
              <>
                <div className="border-b border-stroke-list px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] leading-6 font-bold text-ink-heading">
                      {personagemFoco.nome}
                    </h3>
                    <Tag tom="areia">{ROLE_TYPE_LABEL[personagemFoco.tipoPapel]}</Tag>
                    {(falasPorPersonagem.get(personagemFoco.id) ?? 0) > 0 ? (
                      <span className="text-[12px] leading-[18px] text-ink-caption">
                        {falasPorPersonagem.get(personagemFoco.id)} falas
                      </span>
                    ) : null}
                  </div>

                  {personagemFoco.personId ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[8px] border border-stroke-frame bg-surface-raised px-3 py-2.5">
                      <Avatar
                        nome={personagemFoco.personNome}
                        url={porId.get(personagemFoco.personId)?.fotoUrl}
                        mini={porId.get(personagemFoco.personId)?.fotoMiniUrl}
                        tamanho={40}
                      />
                      <div className="min-w-[150px] flex-1">
                        <Link
                          href={`/admin/pessoas/detalhe?id=${personagemFoco.personId}`}
                          className="flex items-center gap-1 text-[14px] leading-[21px] font-medium text-ink-heading hover:text-brand-strong"
                        >
                          <span className="truncate">{personagemFoco.personNome}</span>
                          <ArrowUpRight size={13} className="shrink-0" />
                        </Link>
                        <Status tom={personagemFoco.situacao === "confirmado" ? "positivo" : "aviso"}>
                          {personagemFoco.situacao === "confirmado" ? "Confirmado" : "Pendente"}
                        </Status>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <Botao
                          variante="ghost"
                          onClick={() => void alternarSituacao(personagemFoco)}
                          disabled={enviando}
                        >
                          {personagemFoco.situacao === "confirmado" ? "Marcar pendente" : "Confirmar"}
                        </Botao>
                        <BotaoIcone
                          rotulo="Retirar da escalação"
                          onClick={() => void escalar(personagemFoco, null)}
                          className="hover:text-state-negative"
                        >
                          <UserMinus size={16} />
                        </BotaoIcone>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] leading-5 text-ink-caption">
                      Ninguém escalado neste papel.
                    </p>
                  )}
                </div>

                <div className="px-4 py-3.5">
                  <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 className="text-[13px] leading-5 font-bold text-ink-heading">Sugestões</h4>
                    <span className="text-[11.5px] leading-4 text-ink-caption">
                      {(personagemFoco.caracteristicasDesejadas ?? []).length > 0
                        ? `Desejado: ${(personagemFoco.caracteristicasDesejadas ?? [])
                            .map((id) => nomeTrait.get(id))
                            .filter(Boolean)
                            .join(", ")}`
                        : "Sem característica desejada"}
                    </span>
                  </div>

                  <div className="relative">
                    <MagnifyingGlass
                      size={16}
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-caption"
                    />
                    <Entrada
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar pelo nome"
                      aria-label="Buscar candidato pelo nome"
                      className="pl-9"
                    />
                  </div>

                  {visiveis.length === 0 ? (
                    <p className="mt-3 text-[13px] text-ink-caption">
                      {busca
                        ? `Ninguém no cadastro com “${busca}”.`
                        : "Nenhuma pessoa cadastrada. Cadastre integrantes na tela Pessoas."}
                    </p>
                  ) : (
                    /*
                      Linhas separadas por fio, não uma caixa por pessoa: oito
                      molduras empilhadas competiam com a moldura do cartão.
                    */
                    <ul className="mt-1 divide-y divide-stroke-list">
                      {visiveis.map((candidato, indice) => {
                        const escaladaAqui = personagemFoco.personId === candidato.pessoa.id;
                        const sugerida = indice === 0 && candidato.cobreTudo;
                        const temMarca =
                          candidato.atende.length > 0 ||
                          candidato.pessoa.ativo === false ||
                          Boolean(candidato.jaEscaladaEm);
                        return (
                          <li key={candidato.pessoa.id} className="flex items-center gap-2.5 py-2">
                            <Avatar
                              nome={candidato.pessoa.nome}
                              url={candidato.pessoa.fotoUrl}
                              mini={candidato.pessoa.fotoMiniUrl}
                              tamanho={28}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] leading-5 font-medium text-ink-heading">
                                {nomeCurto(candidato.pessoa.nome)}
                              </p>
                              {temMarca ? (
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  {candidato.atende.map((id) => (
                                    <Tag key={id} tom="info">
                                      {nomeTrait.get(id)}
                                    </Tag>
                                  ))}
                                  {candidato.pessoa.ativo === false ? (
                                    /* Sem acesso ao app: escalável, mas não recebe aviso nem confirma presença. */
                                    <Tag tom="aviso">Sem acesso</Tag>
                                  ) : null}
                                  {candidato.jaEscaladaEm ? (
                                    <span className="text-[11px] leading-4 text-ink-caption">
                                      também em {candidato.jaEscaladaEm}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {escaladaAqui ? (
                              <Status tom="positivo">Escalado</Status>
                            ) : (
                              <Botao
                                variante={sugerida ? "primario" : "ghost"}
                                onClick={() => void escalar(personagemFoco, candidato.pessoa.id)}
                                disabled={enviando}
                              >
                                Escalar
                              </Botao>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* O corte precisa ser visível: senão a direção acha que o resto do grupo não existe. */}
                  {encontrados.length > visiveis.length ? (
                    <p className="mt-2.5 text-[12px] leading-[18px] text-ink-caption">
                      Mostrando {visiveis.length} de {encontrados.length}. Busque pelo nome para achar
                      quem não está aqui.
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </Cartao>
        </div>
      </div>

      {/*
        A regra mudou quando a direção passou a registrar quem acumulou papéis:
        escalar em outro personagem não mexe mais no anterior. O texto antigo
        prometia o contrário, e era a única explicação da tela.
      */}
      <p className="mt-4 text-[12px] leading-[18px] text-ink-caption">
        A mesma pessoa pode fazer mais de um personagem na peça — quem já está em outro papel
        aparece marcado. A participação entra no histórico dela quando a peça for concluída.
      </p>
    </div>
  );
}
