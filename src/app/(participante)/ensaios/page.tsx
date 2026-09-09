"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listarEnsaios } from "@/lib/db";
import { dataLonga, hojeISO } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import { useAtual } from "@/lib/uso-atual";
import type { Rehearsal } from "@/lib/types";
import { ErroCarregamento, TopoAba } from "@/components/shell";
import { CartaoEnsaio } from "@/components/comum/ensaio-cartao";
import { ConfirmarPresenca } from "@/components/comum/presenca";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import { Abas, Carregando, Vazio } from "@/components/ui";

type Aba = "proximos" | "anteriores";

export default function Ensaios() {
  const { pessoa } = useAuth();
  const atual = useAtual();
  const peca = atual.dados?.peca ?? null;
  const [aba, setAba] = useState<Aba>("proximos");

  const ensaios = useCarregar<Rehearsal[]>("ensaios-da-peca",
    async () => (peca ? listarEnsaios(peca.id) : []),
    [peca?.id],
  );

  const lista = useMemo(() => ensaios.dados ?? [], [ensaios.dados]);
  const hoje = hojeISO();

  // Os mais próximos primeiro; os passados vão para a aba "Anteriores".
  const { proximos, anteriores } = useMemo(
    () => ({
      proximos: lista.filter((e) => e.data >= hoje),
      anteriores: lista.filter((e) => e.data < hoje).reverse(),
    }),
    [lista, hoje],
  );

  function estaConvocado(ensaio: Rehearsal): boolean | undefined {
    if (!pessoa) return undefined;
    return ensaio.todos || ensaio.convocados.includes(pessoa.id);
  }

  if (!pessoa) {
    return (
      <>
        <TopoAba titulo="Ensaios" />
        <SemVinculo />
      </>
    );
  }

  if (atual.carregando) return <Carregando />;
  if (atual.erro)
    return <ErroCarregamento erro={atual.erro} onTentarNovamente={atual.recarregar} />;

  if (!peca) {
    return (
      <>
        <TopoAba titulo="Ensaios" />
        <Vazio
          titulo="Nenhuma peça em andamento"
          descricao="Os ensaios aparecem aqui quando a direção definir a peça atual."
        />
      </>
    );
  }

  const visiveis = aba === "proximos" ? proximos : anteriores;

  return (
    <div>
      <TopoAba titulo="Ensaios" subtitulo={peca.titulo} />

      <Abas
        className="mb-4"
        abas={[
          { chave: "proximos", rotulo: "Próximos", contagem: proximos.length },
          { chave: "anteriores", rotulo: "Anteriores", contagem: anteriores.length },
        ]}
        ativa={aba}
        onTrocar={setAba}
      />

      {ensaios.carregando || ensaios.atualizando ? (
        <Carregando />
      ) : ensaios.erro ? (
        <ErroCarregamento erro={ensaios.erro} onTentarNovamente={ensaios.recarregar} />
      ) : visiveis.length === 0 ? (
        <Vazio
          titulo={aba === "proximos" ? "Nenhum ensaio agendado" : "Nenhum ensaio anterior"}
          descricao={
            aba === "proximos"
              ? "Aguarde a próxima convocação da direção."
              : "Os ensaios já realizados aparecem aqui."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visiveis.map((ensaio, indice) => {
            // A confirmação só faz sentido para ensaio futuro, ativo e ao qual
            // a pessoa foi convocada.
            const pedeResposta =
              aba === "proximos" &&
              estaConvocado(ensaio) === true &&
              ensaio.status !== "cancelado" &&
              ensaio.status !== "concluido";
            return (
              <CartaoEnsaio
                key={ensaio.id}
                ensaio={ensaio}
                destaque={aba === "proximos" && indice === 0}
                convocado={estaConvocado(ensaio)}
                acoes={
                  pedeResposta ? (
                    <ConfirmarPresenca ensaio={ensaio} personId={pessoa.id} nome={pessoa.nome} />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      {peca.dataApresentacao ? (
        <p className="mt-6 text-center text-[12px] leading-[18px] text-ink-caption">
          Apresentação em {dataLonga(peca.dataApresentacao)}
          {peca.local ? ` · ${peca.local}` : ""}
        </p>
      ) : null}
    </div>
  );
}
