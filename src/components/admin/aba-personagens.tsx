"use client";

import { useState } from "react";
import { ImageSquare, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import {
  atualizarPersonagem,
  criarPersonagem,
  removerPersonagem,
  renomearPersonagemNasFalas,
} from "@/lib/db";
import { nomeCurto } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import { LADO_CENA, caminhoDaFotoDoPersonagem } from "@/lib/armazenamento";
import { ROLE_TYPES, ROLE_TYPE_LABEL, type Character, type RoleType, type Trait } from "@/lib/types";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Caixa,
  Campo,
  Cartao,
  Divisor,
  Entrada,
  Modal,
  Selecao,
  Status,
  Tag,
  TituloSecao,
  Vazio,
} from "@/components/ui";
import { EnviarFoto } from "@/components/comum/enviar-foto";
import { FichaInterpretacao } from "./ficha-interpretacao";

function personagemVazio() {
  return {
    nome: "",
    descricao: "",
    tipoPapel: "coadjuvante" as RoleType,
    caracteristicasDesejadas: [] as string[],
    observacoes: "",
    imagemUrl: "",
  };
}

export function AbaPersonagens({
  playId,
  personagens,
  caracteristicas,
  falasPorPersonagem,
  onAtualizar,
}: {
  playId: string;
  personagens: Character[];
  caracteristicas: Trait[];
  /** Quantas falas cada personagem tem no roteiro. */
  falasPorPersonagem: Map<string, number>;
  onAtualizar: () => Promise<void>;
}) {
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /* O personagem recarregado, para a ficha refletir o que foi gravado. */
  const personagemEmEdicao = editandoId
    ? (personagens.find((p) => p.id === editandoId) ?? null)
    : null;
  const [form, setForm] = useState(personagemVazio());
  const [removendo, setRemovendo] = useState<Character | null>(null);

  function abrirNovo() {
    setEditandoId(null);
    setForm(personagemVazio());
    definirErro(null);
    setAberto(true);
  }

  function abrirEdicao(personagem: Character) {
    setEditandoId(personagem.id);
    setForm({
      nome: personagem.nome,
      descricao: personagem.descricao ?? "",
      tipoPapel: personagem.tipoPapel,
      caracteristicasDesejadas: personagem.caracteristicasDesejadas ?? [],
      observacoes: personagem.observacoes ?? "",
      imagemUrl: personagem.imagemUrl ?? "",
    });
    definirErro(null);
    setAberto(true);
  }

  /** A imagem já subiu; gravar na hora evita arquivo sem ninguém apontando. */
  async function salvarImagem(url: string) {
    if (!editandoId) return;
    setForm({ ...form, imagemUrl: url });
    await enviar(async () => {
      await atualizarPersonagem(playId, editandoId, { imagemUrl: url });
      await onAtualizar();
    });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      definirErro("Informe o nome do personagem.");
      return;
    }
    const ok = await enviar(async () => {
      if (editandoId) {
        await atualizarPersonagem(playId, editandoId, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          tipoPapel: form.tipoPapel,
          caracteristicasDesejadas: form.caracteristicasDesejadas,
          observacoes: form.observacoes.trim(),
          imagemUrl: form.imagemUrl.trim(),
        });
        // Mantém o nome do personagem coerente nas falas já cadastradas.
        await renomearPersonagemNasFalas(playId, editandoId, form.nome.trim());
      } else {
        await criarPersonagem(playId, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          tipoPapel: form.tipoPapel,
          caracteristicasDesejadas: form.caracteristicasDesejadas,
          observacoes: form.observacoes.trim(),
          imagemUrl: form.imagemUrl.trim(),
          personId: null,
          personNome: "",
          situacao: "pendente",
          ordem: personagens.length,
        });
      }
      await onAtualizar();
    });
    if (ok) setAberto(false);
  }

  async function remover() {
    if (!removendo) return;
    const alvo = removendo;
    const ok = await enviar(async () => {
      await removerPersonagem(playId, alvo.id);
      await onAtualizar();
    });
    if (ok) setRemovendo(null);
  }


  const semAtor = personagens.filter((p) => !p.personId).length;
  /*
   * A coluna da miniatura só existe quando alguma imagem existe.
   *
   * Ela serve para a direção ver de relance qual papel já tem referência
   * visual — informação que só faz sentido quando há alguma. Numa peça sem
   * imagem nenhuma, o que aparecia era uma coluna de treze caixas vazias
   * idênticas. Como a coluna aparece ou desaparece para a lista inteira, o
   * alinhamento das linhas se mantém nos dois casos.
   */
  const algumComImagem = personagens.some((p) => p.imagemUrl);

  return (
    <div>
      <TituloSecao
        titulo="Personagens"
        descricao="Cada personagem recebe no máximo uma pessoa. As características desejadas alimentam as sugestões na aba Elenco."
        acao={
          <Botao onClick={abrirNovo} className="gap-1.5">
            <Plus size={15} />
            Novo personagem
          </Botao>
        }
      />

      {erro && !aberto && !removendo ? (
        <div className="mb-3">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      {personagens.length === 0 ? (
        <Vazio
          titulo="Nenhum personagem cadastrado"
          descricao="Cadastre os personagens da peça para depois escalar o elenco e montar o roteiro."
          acao={<Botao onClick={abrirNovo}>Novo personagem</Botao>}
        />
      ) : (
        /*
          Uma moldura para a lista inteira, com as linhas separadas por fio.
          Antes cada personagem era um cartão de 180px — nome, tipo, descrição e
          etiquetas empilhados um por linha —, e quatro papéis já enchiam a tela
          de uma peça que costuma ter treze.
        */
        <Cartao className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-stroke-list px-4 py-3">
            <h3 className="text-[14px] leading-5 font-bold text-ink-heading">
              {personagens.length} {personagens.length === 1 ? "personagem" : "personagens"}
            </h3>
            {semAtor > 0 ? (
              <Tag tom="aviso">{semAtor} sem ator</Tag>
            ) : (
              <Status tom="positivo">Todos com ator</Status>
            )}
          </div>

          <ul>
            {personagens.map((personagem) => {
              const desejadas = caracteristicas.filter((t) =>
                personagem.caracteristicasDesejadas?.includes(t.id),
              );
              const falas = falasPorPersonagem.get(personagem.id) ?? 0;
              return (
                <li
                  key={personagem.id}
                  /*
                    Quebra por conta própria: as larguras mínimas abaixo é que
                    empurram as ações e as etiquetas para a linha seguinte
                    quando a tela é estreita. Sem elas, no celular o nome
                    encolhia para os botões caberem ao lado.
                  */
                  className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-stroke-list px-4 py-2.5 last:border-0"
                >
                  {/*
                    A miniatura existe para a direção ver de relance qual papel
                    já tem imagem de referência. Por isso o lugar aparece
                    sempre: só mostrar quando há imagem deixava cada linha
                    começando num ponto diferente, e escondia justamente a
                    informação de que falta imagem.
                  */}
                  {!algumComImagem ? null : personagem.imagemUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={personagem.imagemUrl}
                      alt=""
                      className="h-[34px] w-[48px] shrink-0 rounded-[6px] border border-stroke-frame object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid h-[34px] w-[48px] shrink-0 place-items-center rounded-[6px] border border-dashed border-stroke-frame text-ink-disabled"
                    >
                      <ImageSquare size={15} />
                    </span>
                  )}

                  <div className="min-w-[190px] flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-[14px] leading-[21px] font-medium text-ink-heading">
                        {personagem.nome}
                      </p>
                      <p className="text-[11.5px] leading-4 text-ink-caption">
                        {ROLE_TYPE_LABEL[personagem.tipoPapel]}
                        {falas > 0 ? ` · ${falas} ${falas === 1 ? "fala" : "falas"}` : ""}
                      </p>
                    </div>

                    {personagem.descricao || desejadas.length > 0 ? (
                      /*
                        A descrição cresce e empurra as etiquetas para a direita,
                        então elas terminam no mesmo ponto em todas as linhas.
                        Antes começavam onde a descrição acabava, e cada linha
                        tinha as suas num lugar diferente.
                      */
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <p className="min-w-[100px] flex-1 truncate text-[12.5px] leading-[18px] text-ink-body">
                          {personagem.descricao}
                        </p>
                        {desejadas.length > 0 ? (
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {desejadas.map((t) => (
                              <Tag key={t.id} tom="info">
                                {t.nome}
                              </Tag>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {personagem.observacoes ? (
                      <p className="mt-1.5 line-clamp-2 border-l-2 border-brand pl-2.5 text-[12px] leading-[18px] text-ink-caption">
                        {personagem.observacoes}
                      </p>
                    ) : null}
                  </div>

                  {/*
                    Largura mínima fixa: sem ela a coluna acompanhava o tamanho
                    do nome do ator, e como cada linha tem um nome diferente as
                    etiquetas ao lado terminavam num ponto diferente em cada
                    uma. Com a coluna estável, nomes e etiquetas se alinham.
                  */}
                  <div className="ml-auto flex min-w-[200px] shrink-0 items-center justify-end gap-0.5">
                    <Status tom={personagem.personId ? "positivo" : "aviso"}>
                      {personagem.personNome ? nomeCurto(personagem.personNome) : "Sem ator"}
                    </Status>
                    <BotaoIcone
                      rotulo={`Editar ${personagem.nome}`}
                      onClick={() => abrirEdicao(personagem)}
                    >
                      <PencilSimple size={16} />
                    </BotaoIcone>
                    <BotaoIcone
                      rotulo={`Remover ${personagem.nome}`}
                      onClick={() => setRemovendo(personagem)}
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


      <Modal
        titulo={editandoId ? "Editar personagem" : "Novo personagem"}
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
          <Campo etiqueta="Nome do personagem" obrigatorio>
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Míriam, a mãe"
            />
          </Campo>
          <Campo etiqueta="Descrição">
            <AreaTexto
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Quem é o personagem, sua história e comportamento."
            />
          </Campo>
          <Campo etiqueta="Tipo do papel">
            <Selecao
              value={form.tipoPapel}
              onChange={(e) => setForm({ ...form, tipoPapel: e.target.value as RoleType })}
            >
              {ROLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ROLE_TYPE_LABEL[t]}
                </option>
              ))}
            </Selecao>
          </Campo>

          <div>
            <p className="mb-1.5 text-[12px] leading-[18px] text-ink-caption">
              Características desejadas
            </p>
            <p className="mb-1.5 text-[11px] leading-4 text-ink-caption">
              Usadas para sugerir candidatos na montagem do elenco.
            </p>
            {caracteristicas.length === 0 ? (
              <p className="text-[13px] text-ink-caption">
                Cadastre características na tela Pessoas para usá-las aqui.
              </p>
            ) : (
              <div className="-mx-2">
                {caracteristicas.map((t) => (
                  <Caixa
                    key={t.id}
                    marcada={form.caracteristicasDesejadas.includes(t.id)}
                    onClick={() =>
                      setForm({
                        ...form,
                        caracteristicasDesejadas: form.caracteristicasDesejadas.includes(t.id)
                          ? form.caracteristicasDesejadas.filter((x) => x !== t.id)
                          : [...form.caracteristicasDesejadas, t.id],
                      })
                    }
                  >
                    {t.nome}
                  </Caixa>
                ))}
              </div>
            )}
          </div>

          <Campo
            etiqueta="Observações da direção"
            dica="Estas observações aparecem para a pessoa escalada no personagem."
          >
            <AreaTexto
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Orientações de interpretação, figurino, marcações…"
            />
          </Campo>
          <Campo etiqueta="Imagem do personagem">
            {/*
              * O arquivo mora em pecas/{playId}/{characterId}/, e o id do
              * personagem só existe depois de salvar — por isso a imagem só
              * aparece na edição. Em cena mais larga que retrato, daí LADO_CENA.
              */}
            {editandoId ? (
              <EnviarFoto
                caminho={caminhoDaFotoDoPersonagem(playId, editandoId, form.nome)}
                pasta={`pecas/${playId}/${editandoId}/`}
                atual={form.imagemUrl}
                ladoMaximo={LADO_CENA}
                formato="retangulo"
                rotulo="Escolher imagem"
                onEnviada={(url) => salvarImagem(url)}
                onRemovida={() => salvarImagem("")}
                desabilitado={enviando}
              />
            ) : (
              <p className="text-[12px] leading-[18px] text-ink-caption">
                A imagem é enviada depois de salvar o personagem.
              </p>
            )}
          </Campo>
          {/*
            * A ficha de interpretação só na edição, e no fim.
            *
            * Depende do id, como a imagem — e é material de trabalho, não
            * cadastro: quem está criando o personagem ainda está dizendo que
            * ele existe, não quem ele é.
            */}
          {personagemEmEdicao ? (
            <>
              <Divisor className="my-1" />
              <FichaInterpretacao
                playId={playId}
                personagem={personagemEmEdicao}
                onSalvo={onAtualizar}
              />
            </>
          ) : null}

          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>

      <Modal
        titulo="Remover personagem?"
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
            <strong className="text-ink-heading">{removendo?.nome}</strong> será removido desta
            peça.
          </p>
          <Aviso tom="aviso">
            As falas já cadastradas para este personagem continuam no roteiro, mas ficam sem
            vínculo. Ajuste-as no editor de roteiro depois.
          </Aviso>
          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>
    </div>
  );
}
