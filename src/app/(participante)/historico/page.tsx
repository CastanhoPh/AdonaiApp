"use client";

import { useAuth } from "@/lib/auth-context";
import { listarParticipacoes } from "@/lib/db";
import { ano, nomeCurto } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import type { Participation } from "@/lib/types";
import { ErroCarregamento, TopoParticipante } from "@/components/shell";
import { LinhaParticipacao } from "@/components/comum/participacao-cartao";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import { Carregando, Eyebrow, Vazio } from "@/components/ui";

export default function Historico() {
  const { pessoa } = useAuth();

  const participacoes = useCarregar<Participation[]>("historico",
    async () => (pessoa ? listarParticipacoes(pessoa.id) : []),
    [pessoa?.id],
  );

  const lista = participacoes.dados ?? [];
  // "desde 2019" vem da participação mais antiga do histórico.
  const desde = lista.length > 0 ? ano(lista[lista.length - 1].periodo) : null;

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
          <div className="mb-5 flex items-baseline gap-2.5">
            <span className="fonte-num text-[32px] leading-[38px] font-bold text-brand-strong">
              {lista.length}
            </span>
            <Eyebrow>{lista.length === 1 ? "peça" : "peças"}</Eyebrow>
          </div>

          {lista.length === 0 ? (
            <Vazio
              titulo="Nenhuma participação registrada"
              descricao="Assim que uma peça em que você atuou for concluída pela direção, ela aparece aqui."
            />
          ) : (
            <ul>
              {lista.map((participacao) => (
                <LinhaParticipacao key={participacao.id} participacao={participacao} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
