"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDots, Scroll } from "@phosphor-icons/react";
import {
  buscarCaracteristicasAtribuidas,
  buscarPeca,
  comCaracteristicas,
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
import { AbaEnsaios } from "@/components/admin/aba-ensaios";
import { AbaRoteiro } from "@/components/admin/aba-roteiro";
import { AbaPersonagens } from "@/components/admin/aba-personagens";
import { Abas, Carregando, Tag, Vazio } from "@/components/ui";

type Aba = "dados" | "personagens" | "elenco" | "roteiro" | "ensaios";

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
    const [peca, personagens, pessoas, caracteristicas, falas, ensaios, atribuidas] =
      await Promise.all([
        buscarPeca(id),
        listarPersonagens(id),
        listarPessoas(),
        listarCaracteristicas(),
        listarFalas(id),
        listarEnsaios(id),
        buscarCaracteristicasAtribuidas(),
      ]);
    return {
      peca,
      /*
       * A aba Elenco compara o que o papel pede com o que a pessoa tem, e as
       * duas pontas vêm mescladas aqui — nenhum dos dois documentos guarda
       * mais a avaliação.
       */
      personagens: comCaracteristicas(personagens, atribuidas.papeis, "caracteristicasDesejadas"),
      pessoas: comCaracteristicas(pessoas, atribuidas.pessoas, "caracteristicas"),
      caracteristicas,
      falas,
      ensaios: ensaios.length,
    };
  }, [id]);

  // Atalhos do painel apontam direto para uma aba (&aba=elenco); a escolha
  // feita na tela tem prioridade sobre a da URL.
  const abaPedida = consulta.get("aba");
  const ABAS: Aba[] = ["dados", "personagens", "elenco", "roteiro", "ensaios"];
  const abaDaUrl: Aba = ABAS.includes(abaPedida as Aba) ? (abaPedida as Aba) : "dados";
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
          peca.nomeEvento || null,
          peca.dataApresentacao ? dataLonga(peca.dataApresentacao) : null,
          peca.local || null,
        ]
          .filter(Boolean)
          .join(" · ")}
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
              : peca.roteiroEditadoEm
                ? "Roteiro em edição"
                : "Sem roteiro"}
          </Tag>
          <Tag>{falas.length} falas cadastradas</Tag>
        </div>

        <Abas
          className="mb-5"
          abas={[
            { chave: "dados", rotulo: "Dados" },
            { chave: "personagens", rotulo: "Personagens", contagem: personagens.length },
            { chave: "elenco", rotulo: "Elenco", contagem: escalados },
            { chave: "roteiro", rotulo: "Editor de roteiro", icone: <Scroll size={15} /> },
            {
              chave: "ensaios",
              rotulo: "Ensaios",
              contagem: dados.dados?.ensaios,
              icone: <CalendarDots size={15} />,
            },
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

        {/*
          * Roteiro e Ensaios montam apenas quando escolhidos: cada um carrega
          * as próprias consultas (falas do roteiro, ensaios da peça), e montar
          * os cinco de uma vez faria a aba Dados pagar por tudo.
          */}
        {aba === "roteiro" ? <AbaRoteiro playId={peca.id} /> : null}
        {aba === "ensaios" ? <AbaEnsaios playId={peca.id} /> : null}

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
