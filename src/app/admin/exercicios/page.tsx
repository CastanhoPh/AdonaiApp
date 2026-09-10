"use client";

/**
 * Exercícios de preparação, na visão da direção.
 *
 * O vídeo fica no YouTube; aqui a direção monta a sequência e diz para que
 * serve cada um. A ordem da lista é a ordem do aquecimento, então dá para
 * subir e descer cada item.
 */
import { useState } from "react";
import {
  ArrowSquareOut,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import {
  atualizarExercicio,
  criarExercicio,
  listarExercicios,
  removerExercicio,
  trocarOrdemDoExercicio,
} from "@/lib/db";
import { useCarregar, useEnvio } from "@/lib/hooks";
import { capaDoYoutube, ehLinkDoYoutube, idDoYoutube, linkDoVideo } from "@/lib/youtube";
import type { Exercise } from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Carregando,
  Cartao,
  Entrada,
  Modal,
  Tag,
  Vazio,
} from "@/components/ui";

function vazio() {
  return { nome: "", objetivo: "", youtubeUrl: "" };
}

export default function ExerciciosDaDirecao() {
  const dados = useCarregar<Exercise[]>("admin-exercicios", () => listarExercicios(), []);
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio());
  const [removendo, setRemovendo] = useState<Exercise | null>(null);

  const lista = dados.dados ?? [];

  function abrirNovo() {
    setEditandoId(null);
    setForm(vazio());
    definirErro(null);
    setAberto(true);
  }

  function abrirEdicao(exercicio: Exercise) {
    setEditandoId(exercicio.id);
    setForm({
      nome: exercicio.nome,
      objetivo: exercicio.objetivo ?? "",
      youtubeUrl: exercicio.youtubeUrl ?? "",
    });
    definirErro(null);
    setAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      definirErro("Informe o nome do exercício.");
      return;
    }
    /*
     * O link é conferido aqui, não só no envio.
     *
     * Link errado não dá erro nenhum na gravação: o exercício entra na lista e
     * quem abre é que descobre, no meio do aquecimento, que o vídeo não existe.
     */
    if (!ehLinkDoYoutube(form.youtubeUrl)) {
      definirErro(
        "O link não parece ser de um vídeo do YouTube. Cole o endereço da barra ou o do botão Compartilhar.",
      );
      return;
    }

    const gravado = {
      nome: form.nome.trim(),
      objetivo: form.objetivo.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
    };
    const ok = await enviar(async () => {
      if (editandoId) await atualizarExercicio(editandoId, gravado);
      // Entra no fim da sequência; a direção sobe se quiser antes.
      else await criarExercicio(gravado, lista.length);
      await dados.recarregar();
    });
    if (ok) setAberto(false);
  }

  async function remover() {
    const alvo = removendo;
    if (!alvo) return;
    const ok = await enviar(async () => {
      await removerExercicio(alvo.id);
      await dados.recarregar();
    });
    if (ok) setRemovendo(null);
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const a = lista[indice];
    const b = lista[indice + direcao];
    if (!a || !b) return;
    await enviar(async () => {
      await trocarOrdemDoExercicio(a, b);
      await dados.recarregar();
    });
  }

  if (dados.carregando) {
    return (
      <>
        <TopoAdmin titulo="Exercícios" />
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      </>
    );
  }

  if (dados.erro) {
    return (
      <>
        <TopoAdmin titulo="Exercícios" />
        <CorpoAdmin>
          <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
        </CorpoAdmin>
      </>
    );
  }

  return (
    <>
      <TopoAdmin
        titulo="Exercícios"
        subtitulo="Preparação em vídeo para o elenco, na ordem em que deve ser feita."
        acoes={
          <Botao onClick={abrirNovo} className="gap-1.5">
            <Plus size={15} />
            Novo exercício
          </Botao>
        }
      />

      <CorpoAdmin>
        {erro && !aberto && !removendo ? (
          <div className="mb-3 max-w-2xl">
            <Aviso>{erro}</Aviso>
          </div>
        ) : null}

        {lista.length === 0 ? (
          <Vazio
            titulo="Nenhum exercício cadastrado"
            descricao="Cadastre os vídeos de aquecimento e preparação. O elenco vê a lista na aba Exercícios."
            acao={<Botao onClick={abrirNovo}>Novo exercício</Botao>}
          />
        ) : (
          <Cartao className="max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-stroke-list px-4 py-3">
              <h3 className="text-[14px] leading-5 font-bold text-ink-heading">
                {lista.length} {lista.length === 1 ? "exercício" : "exercícios"}
              </h3>
              <span className="text-[12px] leading-[18px] text-ink-caption">
                Esta é a ordem que o elenco vê
              </span>
            </div>

            <ul>
              {lista.map((exercicio, indice) => {
                const id = idDoYoutube(exercicio.youtubeUrl);
                return (
                  <li
                    key={exercicio.id}
                    className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-stroke-list px-4 py-3 last:border-0"
                  >
                    {id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={capaDoYoutube(id)}
                        alt=""
                        loading="lazy"
                        className="h-[45px] w-[80px] shrink-0 rounded-[6px] border border-stroke-frame bg-surface-deep object-cover"
                      />
                    ) : (
                      <span className="grid h-[45px] w-[80px] shrink-0 place-items-center rounded-[6px] border border-dashed border-stroke-frame">
                        <Tag tom="aviso">Link ruim</Tag>
                      </span>
                    )}

                    <div className="min-w-[190px] flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="text-[14px] leading-[21px] font-medium text-ink-heading">
                          {exercicio.nome}
                        </p>
                        <span className="text-[11.5px] leading-4 text-ink-caption">
                          {indice + 1}º
                        </span>
                      </div>
                      {exercicio.objetivo ? (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[18px] text-ink-body">
                          {exercicio.objetivo}
                        </p>
                      ) : null}
                      <a
                        href={id ? linkDoVideo(id) : exercicio.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[12px] leading-[18px] text-brand-strong hover:underline"
                      >
                        <span className="truncate">{exercicio.youtubeUrl}</span>
                        <ArrowSquareOut size={13} className="shrink-0" />
                      </a>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      <BotaoIcone
                        rotulo={`Subir ${exercicio.nome}`}
                        onClick={() => void mover(indice, -1)}
                        disabled={enviando || indice === 0}
                      >
                        <ArrowUp size={16} />
                      </BotaoIcone>
                      <BotaoIcone
                        rotulo={`Descer ${exercicio.nome}`}
                        onClick={() => void mover(indice, 1)}
                        disabled={enviando || indice === lista.length - 1}
                      >
                        <ArrowDown size={16} />
                      </BotaoIcone>
                      <BotaoIcone
                        rotulo={`Editar ${exercicio.nome}`}
                        onClick={() => abrirEdicao(exercicio)}
                      >
                        <PencilSimple size={16} />
                      </BotaoIcone>
                      <BotaoIcone
                        rotulo={`Remover ${exercicio.nome}`}
                        onClick={() => setRemovendo(exercicio)}
                        className="hover:text-state-negative"
                      >
                        <Trash size={16} />
                      </BotaoIcone>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        )}
      </CorpoAdmin>

      <Modal
        titulo={editandoId ? "Editar exercício" : "Novo exercício"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void salvar()} disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3.5">
          <Campo etiqueta="Nome do exercício" obrigatorio>
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Aquecimento vocal"
            />
          </Campo>

          <Campo etiqueta="Objetivo" dica="O que este exercício treina. É o que o elenco lê.">
            <AreaTexto
              value={form.objetivo}
              onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
              placeholder="Soltar a voz e a respiração antes de ensaiar."
            />
          </Campo>

          <Campo
            etiqueta="Link do YouTube"
            obrigatorio
            dica="Cole o endereço da barra ou o do botão Compartilhar. Vale link normal, youtu.be e Shorts."
          >
            <Entrada
              value={form.youtubeUrl}
              onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
              inputMode="url"
              spellCheck={false}
            />
          </Campo>

          {/*
            A capa aparece enquanto a direção digita: é a confirmação de que o
            link aponta para o vídeo certo, antes de salvar. Link colado errado
            é o defeito mais provável nesta tela, e o mais difícil de notar
            depois.
          */}
          {idDoYoutube(form.youtubeUrl) ? (
            <div className="flex items-center gap-3 rounded-[8px] border border-stroke-frame bg-surface-raised px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capaDoYoutube(idDoYoutube(form.youtubeUrl) as string)}
                alt=""
                className="h-[54px] w-[96px] shrink-0 rounded-[6px] border border-stroke-frame bg-surface-deep object-cover"
              />
              <p className="text-[12.5px] leading-[18px] text-ink-caption">
                Vídeo reconhecido. Confira se é este antes de salvar.
              </p>
            </div>
          ) : form.youtubeUrl.trim() ? (
            <Aviso tom="aviso">
              Não reconheci um vídeo do YouTube neste link. Confira antes de salvar.
            </Aviso>
          ) : null}

          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>

      <Modal
        titulo="Remover exercício?"
        aberto={Boolean(removendo)}
        onFechar={() => setRemovendo(null)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setRemovendo(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={() => void remover()} disabled={enviando}>
              {enviando ? "Removendo…" : "Remover"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3 text-[14px] leading-[21px] text-ink-body">
          <p>
            <strong className="text-ink-heading">{removendo?.nome}</strong> sai da lista do elenco.
            O vídeo continua no YouTube.
          </p>
          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>
    </>
  );
}
