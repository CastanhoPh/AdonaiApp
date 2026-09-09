"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDots, Scroll } from "@phosphor-icons/react";
import {
  buscarPeca,
  listarCaracteristicas,
  listarEnsaios,
  listarFalas,
  listarPersonagens,
  listarPessoas,
} from "@/lib/db";
import { dataLonga } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import {
  PLAY_STATUS_LABEL,
  type Character,
  type Person,
  type Play,
  type ScriptLine,
  type Trait,
} from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin, VoltarPara } from "@/components/shell";
import { AbaDados } from "@/components/admin/aba-dados";
import { AbaElenco } from "@/components/admin/aba-elenco";
import { AbaPersonagens } from "@/components/admin/aba-personagens";
import { Abas, BotaoLink, Carregando, Tag, Vazio } from "@/components/ui";

type Aba = "dados" | "personagens" | "elenco";

interface Dados {
  peca: Play | null;
  personagens: Character[];
  pessoas: Person[];
  caracteristicas: Trait[];
  falas: ScriptLine[];
  ensaios: number;
}

export default function PecaAdmin() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      }
    >
      <ConteudoPeca />
    </Suspense>
  );
}

function ConteudoPeca() {
  const consulta = useSearchParams();
  const id = consulta.get("id") ?? "";

  const dados = useCarregar<Dados>("admin-peca", async () => {
    if (!id) {
      return {
        peca: null,
        personagens: [],
        pessoas: [],
        caracteristicas: [],
        falas: [],
        ensaios: 0,
      };
    }
    const [peca, personagens, pessoas, caracteristicas, falas, ensaios] = await Promise.all([
      buscarPeca(id),
      listarPersonagens(id),
      listarPessoas(),
      listarCaracteristicas(),
      listarFalas(id),
      listarEnsaios(id),
    ]);
    return { peca, personagens, pessoas, caracteristicas, falas, ensaios: ensaios.length };
  }, [id]);

  // Atalhos do painel apontam direto para uma aba (&aba=elenco); a escolha
  // feita na tela tem prioridade sobre a da URL.
  const abaPedida = consulta.get("aba");
  const abaDaUrl: Aba =
    abaPedida === "elenco" || abaPedida === "personagens" ? abaPedida : "dados";
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(null);
  const aba = abaEscolhida ?? abaDaUrl;

  const personagens = dados.dados?.personagens ?? [];
  const falas = useMemo(() => dados.dados?.falas ?? [], [dados.dados]);

  /** Quantas falas cada personagem tem, usado nas duas abas. */
  const falasPorPersonagem = useMemo(() => {
    const mapa = new Map<string, number>();
    falas.forEach((f) => {
      if (f.tipo === "fala" && f.characterId) {
        mapa.set(f.characterId, (mapa.get(f.characterId) ?? 0) + 1);
      }
    });
    return mapa;
  }, [falas]);

  if (dados.carregando) {
    return (
      <CorpoAdmin>
        <Carregando />
      </CorpoAdmin>
    );
  }

  if (dados.erro) {
    return (
      <CorpoAdmin>
        <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
      </CorpoAdmin>
    );
  }

  const peca = dados.dados?.peca ?? null;
  if (!peca) {
    return (
      <CorpoAdmin>
        <VoltarPara href="/admin/pecas" rotulo="Peças" />
        <Vazio titulo="Peça não encontrada" descricao="Ela pode ter sido removida." />
      </CorpoAdmin>
    );
  }

  const escalados = personagens.filter((p) => p.personId).length;

  return (
    <>
      <TopoAdmin
        titulo={peca.titulo}
        subtitulo={[
          PLAY_STATUS_LABEL[peca.status],
          peca.dataApresentacao ? dataLonga(peca.dataApresentacao) : null,
          peca.local || null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <>
            <BotaoLink href={`/admin/pecas/roteiro?id=${peca.id}`} variante="ghost" className="gap-1.5">
              <Scroll size={15} />
              Editor de roteiro
            </BotaoLink>
            <BotaoLink href={`/admin/ensaios?peca=${peca.id}`} variante="ghost" className="gap-1.5">
              <CalendarDots size={15} />
              Ensaios
              {dados.dados?.ensaios ? ` (${dados.dados.ensaios})` : ""}
            </BotaoLink>
          </>
        }
      />

      <CorpoAdmin>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <VoltarPara href="/admin/pecas" rotulo="Peças" />
          {peca.atual ? <Tag tom="areia">Peça atual</Tag> : null}
          <Tag tom={peca.roteiroPublicado ? "positivo" : "neutro"}>
            {peca.roteiroPublicado
              ? `Roteiro v${peca.roteiroVersao} publicado${
                  peca.roteiroPublicadoEm ? ` em ${dataLonga(peca.roteiroPublicadoEm)}` : ""
                }`
              : "Roteiro em edição"}
          </Tag>
          <Tag>{falas.length} falas cadastradas</Tag>
        </div>

        <Abas
          className="mb-5"
          abas={[
            { chave: "dados", rotulo: "Dados" },
            { chave: "personagens", rotulo: "Personagens", contagem: personagens.length },
            { chave: "elenco", rotulo: "Elenco", contagem: escalados },
          ]}
          ativa={aba}
          onTrocar={setAbaEscolhida}
        />

        {aba === "dados" ? (
          <AbaDados
            // Recarregar a peça reinicia o formulário com os dados salvos.
            key={`${peca.status}-${peca.atual}-${peca.titulo}`}
            peca={peca}
            escalados={escalados}
            onAtualizar={dados.recarregar}
          />
        ) : null}

        {aba === "personagens" ? (
          <AbaPersonagens
            playId={peca.id}
            personagens={personagens}
            caracteristicas={dados.dados?.caracteristicas ?? []}
            falasPorPersonagem={falasPorPersonagem}
            onAtualizar={dados.recarregar}
          />
        ) : null}

        {aba === "elenco" ? (
          <AbaElenco
            playId={peca.id}
            personagens={personagens}
            pessoas={dados.dados?.pessoas ?? []}
            caracteristicas={dados.dados?.caracteristicas ?? []}
            falasPorPersonagem={falasPorPersonagem}
            onAtualizar={dados.recarregar}
          />
        ) : null}
      </CorpoAdmin>
    </>
  );
}
