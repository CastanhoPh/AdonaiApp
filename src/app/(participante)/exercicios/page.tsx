"use client";

/**
 * Exercícios de preparação, na visão do elenco.
 *
 * A direção monta a lista e o vídeo mora no YouTube — ninguém precisa de
 * player dentro do app para uma sequência de aquecimento. O que o app faz é
 * dizer qual exercício, para quê, e levar até o vídeo.
 *
 * Não depende de vínculo com uma ficha nem de peça atual: é o mesmo material
 * para todo mundo, e quem acabou de criar a conta já pode treinar.
 */
import { ArrowSquareOut } from "@phosphor-icons/react";
import { listarExercicios } from "@/lib/db";
import { useCarregar } from "@/lib/hooks";
import { capaDoYoutube, idDoYoutube, linkDoVideo } from "@/lib/youtube";
import type { Exercise } from "@/lib/types";
import { ErroCarregamento, TopoAba } from "@/components/shell";
import { Carregando, Cartao, Vazio } from "@/components/ui";

export default function Exercicios() {
  const exercicios = useCarregar<Exercise[]>("exercicios", () => listarExercicios(), []);
  const lista = exercicios.dados ?? [];

  if (exercicios.carregando) {
    return (
      <>
        <TopoAba titulo="Exercícios" />
        <Carregando />
      </>
    );
  }

  if (exercicios.erro) {
    return (
      <>
        <TopoAba titulo="Exercícios" />
        <ErroCarregamento erro={exercicios.erro} onTentarNovamente={exercicios.recarregar} />
      </>
    );
  }

  return (
    <>
      <TopoAba titulo="Exercícios" />

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum exercício ainda"
          descricao="Quando a direção montar a lista de preparação, os vídeos aparecem aqui."
        />
      ) : (
        <>
          <p className="mb-3.5 text-[13px] leading-5 text-ink-caption">
            Preparação montada pela direção. Toque para abrir o vídeo no YouTube.
          </p>
          <ul className="space-y-3">
            {lista.map((exercicio, indice) => (
              <li key={exercicio.id}>
                <ItemExercicio exercicio={exercicio} numero={indice + 1} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function ItemExercicio({ exercicio, numero }: { exercicio: Exercise; numero: number }) {
  const id = idDoYoutube(exercicio.youtubeUrl);

  /*
   * O cartão inteiro é o link, não um botão no canto: no celular o alvo maior
   * é o que se acerta de primeira, e não há mais nada para fazer neste cartão
   * além de abrir o vídeo.
   *
   * Abre em outra aba porque o YouTube não roda dentro do app instalado — e
   * assim ninguém perde o lugar na lista ao voltar.
   */
  const conteudo = (
    <>
      {id ? (
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capaDoYoutube(id)}
            alt=""
            loading="lazy"
            className="h-[63px] w-[112px] rounded-[8px] border border-stroke-frame bg-surface-deep object-cover"
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="eyebrow text-ink-caption">Exercício {numero}</p>
        <p className="mt-0.5 text-[15px] leading-[22px] font-bold text-ink-heading">
          {exercicio.nome}
        </p>
        {exercicio.objetivo ? (
          <p className="mt-1 text-[13px] leading-5 text-ink-body">{exercicio.objetivo}</p>
        ) : null}
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] leading-5 font-medium text-brand-strong">
          {id ? "Abrir no YouTube" : "Abrir o link"}
          <ArrowSquareOut size={14} />
        </span>
      </div>
    </>
  );

  return (
    <Cartao className="p-0">
      <a
        href={id ? linkDoVideo(id) : exercicio.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3.5 rounded-[16px] p-3.5 transition-colors hover:bg-surface-hover"
      >
        {conteudo}
      </a>
    </Cartao>
  );
}
