"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle } from "@phosphor-icons/react";
import { atualizarPersonagem, escalarPessoa } from "@/lib/db";
import { nomeCurto, pluralizar } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import { ROLE_TYPE_LABEL, type Character, type Person, type Trait } from "@/lib/types";
import {
  Avatar,
  Aviso,
  Botao,
  Cartao,
  Divisor,
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

      {pendentes.length > 0 ? (
        <div className="mb-4">
          <Aviso tom="aviso">
            {pluralizar(pendentes.length, "personagem ainda sem ator", "personagens ainda sem ator")}
            : {pendentes.map((p) => p.nome).join(", ")}.
          </Aviso>
        </div>
      ) : (
        <div className="mb-4">
          <Aviso tom="positivo">Todos os personagens têm alguém escalado.</Aviso>
        </div>
      )}

      <div className="grid gap-4 min-[900px]:grid-cols-2">
        {/* Personagens da peça */}
        <Cartao className="px-4 py-4">
          <h3 className="mb-3 text-[15px] leading-6 font-bold text-ink-heading">
            Personagens da peça
          </h3>
          <ul>
            {personagens.map((personagem) => {
              const foco = personagem.id === personagemFoco?.id;
              const falas = falasPorPersonagem.get(personagem.id) ?? 0;
              return (
                <li key={personagem.id} className="border-b border-stroke-list last:border-0">
                  <button
                    type="button"
                    onClick={() => setEmFoco(personagem.id)}
                    className={juntar(
                      "flex w-full items-center justify-between gap-3 px-2 py-3 text-left transition-colors",
                      foco ? "bg-brand/14" : "hover:bg-surface-hover",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] leading-[21px] font-medium text-ink-heading">
                        {personagem.nome}
                      </span>
                      <span className="block text-[12px] leading-[18px] text-ink-caption">
                        {foco && !personagem.personId
                          ? "Selecionado · escalando agora"
                          : `${ROLE_TYPE_LABEL[personagem.tipoPapel]}${falas > 0 ? ` · ${falas} falas` : ""}`}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] leading-5 text-ink-body">
                        {personagem.personNome ? nomeCurto(personagem.personNome) : "Não definido"}
                      </span>
                    </span>
                    <span className="shrink-0">
                      <Status tom={personagem.situacao === "confirmado" ? "positivo" : "aviso"}>
                        {personagem.situacao === "confirmado" ? "Confirmado" : "Pendente"}
                      </Status>
                    </span>
                  </button>

                  {foco && personagem.personId ? (
                    <div className="flex flex-wrap gap-2 px-2 pb-3">
                      <Botao
                        variante="ghost"
                        onClick={() => void alternarSituacao(personagem)}
                        disabled={enviando}
                      >
                        {personagem.situacao === "confirmado"
                          ? "Marcar como pendente"
                          : "Confirmar"}
                      </Botao>
                      <Botao
                        variante="perigo"
                        onClick={() => void escalar(personagem, null)}
                        disabled={enviando}
                      >
                        Retirar da escalação
                      </Botao>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Cartao>

        {/* Candidatos */}
        <Cartao className="px-4 py-4">
          {!personagemFoco ? (
            <p className="text-[13px] text-ink-caption">
              Escolha um personagem à esquerda para ver candidatos.
            </p>
          ) : (
            <>
              <h3 className="text-[15px] leading-6 font-bold text-ink-heading">
                Candidatos para “{personagemFoco.nome}”
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] leading-[18px] text-ink-caption">
                {(personagemFoco.caracteristicasDesejadas ?? []).length > 0
                  ? `Desejado: ${(personagemFoco.caracteristicasDesejadas ?? [])
                      .map((id) => nomeTrait.get(id))
                      .filter(Boolean)
                      .join(", ")}`
                  : "Nenhuma característica desejada definida para este papel."}
              </p>

              {candidatos.length === 0 ? (
                <p className="text-[13px] text-ink-caption">
                  Nenhuma pessoa ativa cadastrada. Cadastre integrantes na tela Pessoas.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {candidatos.slice(0, 8).map((candidato, indice) => {
                    const escaladaAqui = personagemFoco.personId === candidato.pessoa.id;
                    return (
                      <li
                        key={candidato.pessoa.id}
                        className="flex items-center gap-3 rounded-[8px] border border-stroke-frame px-3 py-2.5"
                      >
                        <Avatar
                          nome={candidato.pessoa.nome}
                          url={candidato.pessoa.fotoUrl}
                          tamanho={40}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] leading-[21px] font-medium text-ink-heading">
                            {nomeCurto(candidato.pessoa.nome)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                                Já escalado em {candidato.jaEscaladaEm}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {escaladaAqui ? (
                          <Status tom="positivo">Escalado</Status>
                        ) : (
                          <Botao
                            variante={indice === 0 && candidato.cobreTudo ? "primario" : "ghost"}
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

              {personagemFoco.personId ? (
                <>
                  <Divisor className="my-3.5" />
                  <Link
                    href={`/admin/pessoas/detalhe?id=${personagemFoco.personId}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
                  >
                    Ver perfil de {nomeCurto(personagemFoco.personNome)}
                    <ArrowUpRight size={14} />
                  </Link>
                </>
              ) : null}
            </>
          )}
        </Cartao>
      </div>

      <p className="mt-4 text-[12px] leading-[18px] text-ink-caption">
        Uma pessoa interpreta apenas um personagem por peça: ao escalá-la em outro papel, o
        anterior volta para pendente. A participação entra no histórico da pessoa quando a peça for
        concluída.
      </p>
    </div>
  );
}
