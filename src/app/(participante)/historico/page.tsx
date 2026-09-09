"use client";

import { useAuth } from "@/lib/auth-context";
import { listarParticipacoes, listarPecasDirigidas } from "@/lib/db";
import { ano, nomeCurto } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import type { Participation, Play } from "@/lib/types";
import { ErroCarregamento, TopoParticipante } from "@/components/shell";
import { LinhaParticipacao } from "@/components/comum/participacao-cartao";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import { Carregando, Eyebrow, Tag, Vazio } from "@/components/ui";

export default function Historico() {
  const { pessoa } = useAuth();

  const participacoes = useCarregar<Participation[]>("historico",
    async () => (pessoa ? listarParticipacoes(pessoa.id) : []),
    [pessoa?.id],
  );

  /*
   * Direção é uma seção própria, não uma linha do elenco. Quem dirigiu não
   * atuou, e misturar as duas faria o histórico dizer que a pessoa fez um
   * personagem chamado "diretor".
   */
  const dirigidas = useCarregar<Play[]>("historico-direcao",
    async () => (pessoa ? listarPecasDirigidas(pessoa.id) : []),
    [pessoa?.id],
  );

  const lista = participacoes.dados ?? [];
  const direcao = dirigidas.dados ?? [];
  /*
   * "desde 2019" olha atuação e direção. Quem começou dirigindo tem esse ano
   * como início da caminhada no teatro, não o da primeira vez em que atuou.
   */
  const datas = [
    ...lista.map((p) => p.periodo),
    ...direcao.map((p) => p.dataApresentacao),
  ].filter(Boolean);
  const desde = datas.length > 0 ? ano(datas.sort()[0]) : null;

  if (!pessoa) {
    return (
      <>
        <TopoParticipante titulo="Histórico" voltarPara="/inicio" />
        <SemVinculo />
      </>
    );
  }

  return (
    <div>
      <TopoParticipante
        titulo="Histórico"
        subtitulo={
          desde ? `${nomeCurto(pessoa.nome)} · desde ${desde}` : nomeCurto(pessoa.nome)
        }
        voltarPara="/inicio"
      />

      {participacoes.carregando ? (
        <Carregando />
      ) : participacoes.erro ? (
        <ErroCarregamento erro={participacoes.erro} onTentarNovamente={participacoes.recarregar} />
      ) : (
        <>
          {/*
            * Dois números em vez de um: somar atuação com direção esconderia a
            * diferença, e quem só dirigiu apareceria com "0 peças" ao lado de
            * uma lista de peças dirigidas.
            */}
          <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2.5">
              <span className="fonte-num text-[32px] leading-[38px] font-bold text-brand-strong">
                {lista.length}
              </span>
              <Eyebrow>{lista.length === 1 ? "peça atuada" : "peças atuadas"}</Eyebrow>
            </div>
            {direcao.length > 0 ? (
              <div className="flex items-baseline gap-2.5">
                <span className="fonte-num text-[32px] leading-[38px] font-bold text-ink-heading">
                  {direcao.length}
                </span>
                <Eyebrow>{direcao.length === 1 ? "dirigida" : "dirigidas"}</Eyebrow>
              </div>
            ) : null}
          </div>

          {lista.length === 0 && direcao.length === 0 ? (
            <Vazio
              titulo="Nenhuma participação registrada"
              descricao="Assim que uma peça em que você atuou for concluída pela direção, ela aparece aqui."
            />
          ) : (
            <>
              {lista.length > 0 ? (
                <ul>
                  {lista.map((participacao) => (
                    <LinhaParticipacao key={participacao.id} participacao={participacao} />
                  ))}
                </ul>
              ) : null}

              {direcao.length > 0 ? (
                <section className="mt-6">
                  <Eyebrow>
                    {direcao.length === 1 ? "Peça que você dirigiu" : "Peças que você dirigiu"}
                  </Eyebrow>
                  <ul className="mt-2">
                    {direcao.map((peca) => (
                      <li
                        key={peca.id}
                        className="flex items-start gap-4 border-b border-stroke-list py-3.5 last:border-0"
                      >
                        <span className="fonte-num w-10 shrink-0 text-[13px] leading-5 font-bold text-ink-caption">
                          {ano(peca.dataApresentacao)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] leading-[22px] font-bold text-ink-heading">
                            {peca.titulo}
                          </p>
                          {peca.nomeEvento ? (
                            <p className="text-[12px] leading-[18px] text-ink-caption">
                              {peca.nomeEvento}
                            </p>
                          ) : null}
                        </div>
                        <Tag className="mt-0.5">
                          {peca.diretores?.includes(pessoa.id) ? "Direção" : "Vice-direção"}
                        </Tag>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
