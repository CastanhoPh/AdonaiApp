"use client";

import { useState } from "react";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
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
  Entrada,
  Modal,
  Selecao,
  Status,
  Tag,
  TituloSecao,
  Vazio,
} from "@/components/ui";
import { EnviarFoto } from "@/components/comum/enviar-foto";

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

  return (
    <div>
      <TituloSecao
        titulo="Personagens"
        descricao="Cada personagem pertence a esta peça e recebe no máximo uma pessoa."
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
        <ul className="space-y-3">
          {personagens.map((personagem) => {
            const desejadas = caracteristicas.filter((t) =>
              personagem.caracteristicasDesejadas?.includes(t.id),
            );
            const falas = falasPorPersonagem.get(personagem.id) ?? 0;
            return (
              <li key={personagem.id}>
                <Cartao className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Miniatura para a direção conferir de relance qual papel já tem imagem. */}
                    {personagem.imagemUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={personagem.imagemUrl}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-[8px] border border-stroke-frame object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-[22px] font-bold text-ink-heading">
                        {personagem.nome}
                      </p>
                      <p className="text-[13px] leading-5 text-ink-caption">
                        {ROLE_TYPE_LABEL[personagem.tipoPapel]}
                        {falas > 0 ? ` · ${falas} ${falas === 1 ? "fala" : "falas"}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Status tom={personagem.personId ? "positivo" : "aviso"}>
                        {personagem.personNome ? nomeCurto(personagem.personNome) : "Sem ator"}
                      </Status>
                      <BotaoIcone
                        rotulo={`Editar ${personagem.nome}`}
                        onClick={() => abrirEdicao(personagem)}
                      >
                        <PencilSimple size={17} />
                      </BotaoIcone>
                      <BotaoIcone
                        rotulo={`Remover ${personagem.nome}`}
                        onClick={() => setRemovendo(personagem)}
                        className="hover:text-[#e4796c]"
                      >
                        <Trash size={17} />
                      </BotaoIcone>
                    </div>
                  </div>

                  {personagem.descricao ? (
                    <p className="mt-2 text-[13px] leading-5 text-ink-body">
                      {personagem.descricao}
                    </p>
                  ) : null}

                  {desejadas.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {desejadas.map((t) => (
                        <Tag key={t.id} tom="info">
                          {t.nome}
                        </Tag>
                      ))}
                    </div>
                  ) : null}

                  {personagem.observacoes ? (
                    <p className="mt-2.5 border-l-2 border-brand pl-3 text-[13px] leading-5 whitespace-pre-line text-ink-caption">
                      {personagem.observacoes}
                    </p>
                  ) : null}
                </Cartao>
              </li>
            );
          })}
        </ul>
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
                caminho={caminhoDaFotoDoPersonagem(playId, editandoId)}
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
