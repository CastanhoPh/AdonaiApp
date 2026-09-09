"use client";

import { useAuth } from "@/lib/auth-context";
import { listarCaracteristicas, listarFalasDoPersonagem } from "@/lib/db";
import { useCarregar } from "@/lib/hooks";
import { useAtual } from "@/lib/uso-atual";
import { ROLE_TYPE_LABEL, type Trait } from "@/lib/types";
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
  falas: number;
  cenasDoPersonagem: number;
  cenasDaPeca: number;
}

export default function MeuPersonagem() {
  const { pessoa } = useAuth();
  const atual = useAtual();
  const peca = atual.dados?.peca ?? null;
  const personagem = atual.dados?.personagem ?? null;

  /*
   * "14 falas" e "4 de 7 cenas" vêm do roteiro. Só as falas deste personagem
   * são baixadas; o total de cenas da peça é o que a direção gravou ao
   * publicar, para não varrer o roteiro inteiro nesta tela.
   */
  const numeros = useCarregar<Numeros>(
    "personagem-numeros",
    async () => {
      if (!peca || !personagem) return { falas: 0, cenasDoPersonagem: 0, cenasDaPeca: 0 };
      const minhas = await listarFalasDoPersonagem(peca.id, personagem.id);
      const falas = minhas.filter((f) => f.tipo === "fala");
      return {
        falas: falas.length,
        cenasDoPersonagem: new Set(falas.map((f) => `${f.ato}-${f.cena}`)).size,
        cenasDaPeca: peca.totalCenas ?? 0,
      };
    },
    [peca?.id, personagem?.id, peca?.totalCenas],
  );

  const caracteristicas = useCarregar<Trait[]>(
    "caracteristicas-do-papel",
    async () => (personagem?.caracteristicasDesejadas?.length ? listarCaracteristicas() : []),
    [personagem?.id],
  );
  const desejadas = (caracteristicas.dados ?? []).filter((t) =>
    personagem?.caracteristicasDesejadas?.includes(t.id),
  );

  if (!pessoa) {
    return (
      <>
        <TopoParticipante titulo="Meu personagem" voltarPara="/inicio" />
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
        <TopoParticipante titulo="Meu personagem" voltarPara="/inicio" />
        <Vazio
          titulo="Nenhuma peça em andamento"
          descricao="Quando a direção definir a peça atual, seu personagem aparece aqui."
        />
      </>
    );
  }

  if (!personagem) {
    return (
      <>
        <TopoParticipante titulo="Meu personagem" subtitulo={peca.titulo} voltarPara="/inicio" />
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

  const n = numeros.dados;

  return (
    <div>
      <TopoParticipante titulo="Meu personagem" voltarPara="/inicio" />

      {/* Hero do personagem */}
      <Cartao className="relative mb-4 overflow-hidden bg-surface-raised px-4 py-5">
        <MarcaAlianca
          tamanho={120}
          opacidade={0.07}
          className="pointer-events-none absolute -top-6 -right-8"
        />
        <div className="relative">
          <Eyebrow>{peca.titulo}</Eyebrow>
          <h2 className="mt-2 text-[32px] leading-[38px] font-bold text-ink-heading">
            {personagem.nome}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag tom="areia">{ROLE_TYPE_LABEL[personagem.tipoPapel]}</Tag>
            {n && n.cenasDaPeca > 0 ? (
              <Tag>
                {n.cenasDoPersonagem} de {n.cenasDaPeca} cenas
              </Tag>
            ) : null}
            {n && n.falas > 0 ? (
              <Tag>
                {n.falas} {n.falas === 1 ? "fala" : "falas"}
              </Tag>
            ) : null}
            <Tag tom={personagem.situacao === "confirmado" ? "positivo" : "aviso"}>
              {personagem.situacao === "confirmado" ? "Confirmado" : "Pendente"}
            </Tag>
          </div>
        </div>
      </Cartao>

      <section className="mb-5">
        <Eyebrow>Descrição</Eyebrow>
        <p className="mt-2 text-[15px] leading-[23px] text-ink-body">
          {personagem.descricao || "A direção ainda não escreveu a descrição do personagem."}
        </p>
      </section>

      {personagem.observacoes ? (
        <section className="mb-5">
          <Eyebrow>Observações da direção</Eyebrow>
          <div className="mt-2 border-l-2 border-brand py-1 pl-3.5">
            <p className="text-[15px] leading-[23px] whitespace-pre-line text-ink-body">
              {personagem.observacoes}
            </p>
          </div>
        </section>
      ) : null}

      {desejadas.length > 0 ? (
        <section className="mb-5">
          <Eyebrow>O papel pede</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            {desejadas.map((t) => (
              <Tag key={t.id} tom="info">
                {t.nome}
              </Tag>
            ))}
          </div>
        </section>
      ) : null}

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
