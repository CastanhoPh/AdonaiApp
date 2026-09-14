"use client";

/**
 * Os papéis da pessoa na peça atual.
 *
 * Plural de propósito: a mesma pessoa pode acumular papéis numa peça — em "A
 * Resposta" alguém fez assistente do rei, guerreiro e narrador. Com um papel
 * só, a tela é a de sempre; com mais de um, cada papel vira um bloco e o
 * título passa a "Meus personagens".
 */
import { useAuth } from "@/lib/auth-context";
import { listarFalas } from "@/lib/db";
import { useCarregar } from "@/lib/hooks";
import { useAtual } from "@/lib/uso-atual";
import { ROLE_TYPE_LABEL, type Character } from "@/lib/types";
import { ErroCarregamento, TopoParticipante } from "@/components/shell";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import {
  BotaoLink,
  Cartao,
  Carregando,
  Eyebrow,
  MarcaAlianca,
  Tag,
  Vazio,
} from "@/components/ui";

interface Numeros {
  /** characterId → falas e cenas daquele papel. */
  porPapel: Record<string, { falas: number; cenas: number }>;
  cenasDaPeca: number;
}

export default function MeusPersonagens() {
  const { pessoa } = useAuth();
  const atual = useAtual();
  const peca = atual.dados?.peca ?? null;
  const personagens = atual.dados?.personagens ?? [];

  /*
   * "14 falas" e "4 de 7 cenas" vêm do roteiro.
   *
   * Com vários papéis, uma consulta por papel seria uma ida ao servidor por
   * personagem. O roteiro da peça vem numa só e é dividido aqui — é o mesmo
   * dado que a tela de roteiro já baixa.
   */
  const numeros = useCarregar<Numeros>(
    "numeros-dos-papeis",
    async () => {
      if (!peca || personagens.length === 0) return { porPapel: {}, cenasDaPeca: 0 };
      const falas = (await listarFalas(peca.id)).filter((f) => f.tipo === "fala");
      const porPapel: Numeros["porPapel"] = {};
      for (const papel of personagens) {
        const minhas = falas.filter((f) => f.characterIds.includes(papel.id));
        porPapel[papel.id] = {
          falas: minhas.length,
          cenas: new Set(minhas.map((f) => `${f.ato}-${f.cena}`)).size,
        };
      }
      return { porPapel, cenasDaPeca: peca.totalCenas ?? 0 };
    },
    [peca?.id, peca?.totalCenas, personagens.map((p) => p.id).join(",")],
  );

  const varios = personagens.length > 1;
  const titulo = varios ? "Meus personagens" : "Meu personagem";

  if (!pessoa) {
    return (
      <>
        <TopoParticipante titulo={titulo} voltarPara="/inicio" />
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
        <TopoParticipante titulo={titulo} voltarPara="/inicio" />
        <Vazio
          titulo="Nenhuma peça em andamento"
          descricao="Quando a direção definir a peça atual, seu personagem aparece aqui."
        />
      </>
    );
  }

  if (personagens.length === 0) {
    return (
      <>
        <TopoParticipante titulo={titulo} subtitulo={peca.titulo} voltarPara="/inicio" />
        <Vazio
          titulo="Nos vemos na próxima peça!"
          descricao={`Você não está escalado em ${peca.titulo}. Seu histórico continua disponível.`}
          acao={
            <BotaoLink href="/historico" variante="ghost">
              Ver meu histórico
            </BotaoLink>
          }
        />
      </>
    );
  }

  return (
    <div>
      <TopoParticipante
        titulo={titulo}
        subtitulo={varios ? `${peca.titulo} · ${personagens.length} papéis` : undefined}
        voltarPara="/inicio"
      />

      {personagens.map((papel, i) => (
        <BlocoDoPapel
          key={papel.id}
          papel={papel}
          tituloDaPeca={peca.titulo}
          numeros={numeros.dados?.porPapel[papel.id]}
          cenasDaPeca={numeros.dados?.cenasDaPeca ?? 0}
          /* Só o primeiro leva o nome da peça acima do nome do papel. */
          mostrarPeca={i === 0}
        />
      ))}

      {peca.roteiroPublicado ? (
        <BotaoLink href="/roteiro" altura="form" larguraTotal>
          Ver minhas falas no roteiro
        </BotaoLink>
      ) : (
        <Cartao className="px-4 py-3.5">
          <p className="text-[13px] leading-5 text-ink-caption">
            O roteiro ainda não foi publicado pela direção.
          </p>
        </Cartao>
      )}
    </div>
  );
}

function BlocoDoPapel({
  papel,
  tituloDaPeca,
  numeros,
  cenasDaPeca,
  mostrarPeca,
}: {
  papel: Character;
  tituloDaPeca: string;
  numeros?: { falas: number; cenas: number };
  cenasDaPeca: number;
  mostrarPeca: boolean;
}) {
  return (
    <section className="mb-6">
      <Cartao className="relative mb-4 overflow-hidden bg-surface-raised">
        {/*
          * Imagem que a direção enviou para o papel: figurino, referência de
          * cena. Só aparece quando existe — sem ela fica a marca em watermark.
          */}
        {papel.imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={papel.imagemUrl}
            alt={`Referência de ${papel.nome}`}
            className="h-44 w-full border-b border-stroke-frame object-cover"
          />
        ) : (
          <MarcaAlianca
            tamanho={120}
            opacidade={0.07}
            className="pointer-events-none absolute -top-6 -right-8"
          />
        )}
        <div className="relative px-4 py-5">
          {mostrarPeca ? <Eyebrow>{tituloDaPeca}</Eyebrow> : null}
          <h2 className="mt-2 text-[32px] leading-[38px] font-bold text-ink-heading">
            {papel.nome}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag tom="areia">{ROLE_TYPE_LABEL[papel.tipoPapel]}</Tag>
            {numeros && cenasDaPeca > 0 ? (
              <Tag>
                {numeros.cenas} de {cenasDaPeca} cenas
              </Tag>
            ) : null}
            {numeros && numeros.falas > 0 ? (
              <Tag>
                {numeros.falas} {numeros.falas === 1 ? "fala" : "falas"}
              </Tag>
            ) : null}
            <Tag tom={papel.situacao === "confirmado" ? "positivo" : "aviso"}>
              {papel.situacao === "confirmado" ? "Confirmado" : "Pendente"}
            </Tag>
          </div>
        </div>
      </Cartao>

      <div className="mb-5">
        <Eyebrow>Descrição</Eyebrow>
        <p className="mt-2 text-[15px] leading-[23px] text-ink-body">
          {papel.descricao || "A direção ainda não escreveu a descrição do personagem."}
        </p>
      </div>

      {papel.observacoes ? (
        <div>
          <Eyebrow>Observações da direção</Eyebrow>
          <div className="mt-2 border-l-2 border-brand py-1 pl-3.5">
            <p className="text-[15px] leading-[23px] whitespace-pre-line text-ink-body">
              {papel.observacoes}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
