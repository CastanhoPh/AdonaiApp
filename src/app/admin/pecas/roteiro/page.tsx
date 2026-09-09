"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowsDownUp, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import {
  atualizarFala,
  buscarPeca,
  criarFala,
  listarFalas,
  listarPersonagens,
  marcarRoteiroEditado,
  publicarRoteiro,
  removerFala,
  renomearCena,
  reordenarFalas,
} from "@/lib/db";
import { editadoEm, pluralizar, rotuloAto, rotuloCena } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  LINE_KINDS,
  LINE_KIND_LABEL,
  type Character,
  type LineKind,
  type Play,
  type ScriptLine,
} from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin, VoltarPara } from "@/components/shell";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Carregando,
  Divisor,
  Entrada,
  Eyebrow,
  Modal,
  Selecao,
  Tag,
  Vazio,
  juntar,
} from "@/components/ui";

interface Dados {
  peca: Play | null;
  personagens: Character[];
  falas: ScriptLine[];
}

interface Cena {
  ato: number;
  atoTitulo: string;
  cena: number;
  cenaTitulo: string;
  falas: ScriptLine[];
}

/** Estrutura de atos e cenas derivada das falas. */
function estruturar(falas: ScriptLine[]): Cena[] {
  const cenas: Cena[] = [];
  for (const fala of falas) {
    let cena = cenas.find((c) => c.ato === fala.ato && c.cena === fala.cena);
    if (!cena) {
      cena = {
        ato: fala.ato,
        atoTitulo: fala.atoTitulo ?? "",
        cena: fala.cena,
        cenaTitulo: fala.cenaTitulo ?? "",
        falas: [],
      };
      cenas.push(cena);
    }
    if (!cena.atoTitulo && fala.atoTitulo) cena.atoTitulo = fala.atoTitulo;
    if (!cena.cenaTitulo && fala.cenaTitulo) cena.cenaTitulo = fala.cenaTitulo;
    cena.falas.push(fala);
  }
  return cenas;
}

export default function EditorRoteiro() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      }
    >
      <ConteudoRoteiro />
    </Suspense>
  );
}

function ConteudoRoteiro() {
  const id = useSearchParams().get("id") ?? "";

  const dados = useCarregar<Dados>("admin-roteiro", async () => {
    if (!id) return { peca: null, personagens: [], falas: [] };
    const [peca, personagens, falas] = await Promise.all([
      buscarPeca(id),
      listarPersonagens(id),
      listarFalas(id),
    ]);
    return { peca, personagens, falas };
  }, [id]);

  const { enviando, erro, definirErro, enviar } = useEnvio();

  const peca = dados.dados?.peca ?? null;
  const personagens = dados.dados?.personagens ?? [];
  const falas = useMemo(() => dados.dados?.falas ?? [], [dados.dados]);
  const cenas = useMemo(() => estruturar(falas), [falas]);

  const [chaveFoco, setChaveFoco] = useState<string | null>(null);
  const cenaFoco = cenas.find((c) => `${c.ato}-${c.cena}` === chaveFoco) ?? cenas[0] ?? null;

  /** Texto em edição por linha, gravado no blur. */
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [novaLinha, setNovaLinha] = useState<LineKind | null>(null);
  const [formLinha, setFormLinha] = useState({ characterId: "", texto: "" });
  const [novaCena, setNovaCena] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const semPersonagem = falas.filter((f) => f.tipo === "fala" && !f.characterId).length;
  const vinculadas = falas.filter((f) => f.tipo === "fala" && f.characterId).length;

  async function gravarTexto(fala: ScriptLine) {
    const texto = rascunhos[fala.id];
    if (texto === undefined || texto === fala.texto) return;
    await enviar(async () => {
      await atualizarFala(id, fala.id, { texto });
      await marcarRoteiroEditado(id);
      await dados.recarregar();
    });
    setRascunhos((r) => {
      const copia = { ...r };
      delete copia[fala.id];
      return copia;
    });
  }

  async function trocarPersonagem(fala: ScriptLine, characterId: string) {
    const personagem = personagens.find((p) => p.id === characterId) ?? null;
    await enviar(async () => {
      await atualizarFala(id, fala.id, {
        characterId: characterId || null,
        characterNome: personagem?.nome ?? "",
      });
      await marcarRoteiroEditado(id);
      await dados.recarregar();
    });
  }

  async function mover(indice: number, direcao: -1 | 1) {
    if (!cenaFoco) return;
    const destino = indice + direcao;
    if (destino < 0 || destino >= cenaFoco.falas.length) return;
    const nova = [...cenaFoco.falas];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    await enviar(async () => {
      await reordenarFalas(id, nova);
      await marcarRoteiroEditado(id);
      await dados.recarregar();
    });
  }

  async function excluir(fala: ScriptLine) {
    await enviar(async () => {
      await removerFala(id, fala.id);
      await marcarRoteiroEditado(id);
      await dados.recarregar();
    });
  }

  async function adicionarLinha() {
    if (!cenaFoco || !novaLinha) return;
    if (!formLinha.texto.trim()) {
      definirErro("Escreva o texto da linha.");
      return;
    }
    if (novaLinha === "fala" && !formLinha.characterId) {
      definirErro("Escolha o personagem que diz esta fala.");
      return;
    }
    const personagem = personagens.find((p) => p.id === formLinha.characterId) ?? null;
    const ok = await enviar(async () => {
      await criarFala(id, {
        ato: cenaFoco.ato,
        atoTitulo: cenaFoco.atoTitulo,
        cena: cenaFoco.cena,
        cenaTitulo: cenaFoco.cenaTitulo,
        ordem: cenaFoco.falas.length,
        tipo: novaLinha,
        characterId: novaLinha === "fala" ? formLinha.characterId : null,
        characterNome: novaLinha === "fala" ? (personagem?.nome ?? "") : "",
        texto: formLinha.texto.trim(),
      });
      await marcarRoteiroEditado(id);
      await dados.recarregar();
    });
    if (ok) {
      setNovaLinha(null);
      setFormLinha({ characterId: "", texto: "" });
    }
  }

  async function publicar() {
    if (!peca) return;
    const versaoNova = peca.roteiroPublicado ? peca.roteiroVersao + 1 : peca.roteiroVersao;
    const ok = await enviar(async () => {
      await publicarRoteiro(id, peca, {
        falas: falas.length,
        cenas: new Set(falas.map((f) => `${f.ato}-${f.cena}`)).size,
      });
      await dados.recarregar();
    });
    if (ok) {
      setPublicando(false);
      setAviso(`Versão ${versaoNova} publicada para o elenco.`);
    }
  }

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

  if (!peca) {
    return (
      <CorpoAdmin>
        <VoltarPara href="/admin/pecas" rotulo="Peças" />
        <Vazio titulo="Peça não encontrada" descricao="Ela pode ter sido removida." />
      </CorpoAdmin>
    );
  }

  const atos = Array.from(new Set(cenas.map((c) => c.ato))).sort((a, b) => a - b);

  return (
    <>
      <TopoAdmin
        titulo="Editor de roteiro"
        subtitulo={`${peca.titulo} · ${
          peca.roteiroPublicado
            ? `versão ${peca.roteiroVersao} publicada`
            : "nunca publicado"
        } · última edição ${editadoEm(peca.roteiroEditadoEm)}`}
        acoes={
          <>
            <Botao
              variante="ghost"
              onClick={() => void enviar(async () => {
                await marcarRoteiroEditado(id);
                await dados.recarregar();
              })}
              disabled={enviando}
            >
              Salvar rascunho
            </Botao>
            <Botao
              onClick={() => setPublicando(true)}
              disabled={enviando || falas.length === 0}
            >
              Publicar versão
            </Botao>
          </>
        }
      />

      <CorpoAdmin>
        <VoltarPara href={`/admin/pecas/detalhe?id=${id}`} rotulo={peca.titulo} />

        {aviso ? (
          <div className="mb-4">
            <Aviso tom="positivo">{aviso}</Aviso>
          </div>
        ) : null}
        {erro && !novaLinha && !novaCena && !renomeando && !publicando ? (
          <div className="mb-4">
            <Aviso>{erro}</Aviso>
          </div>
        ) : null}
        {personagens.length === 0 ? (
          <div className="mb-4">
            <Aviso tom="aviso">
              Esta peça ainda não tem personagens. Cadastre-os na aba Personagens — é o vínculo
              entre fala e personagem que faz o app destacar as falas de cada participante.
            </Aviso>
          </div>
        ) : null}
        {semPersonagem > 0 ? (
          <div className="mb-4">
            <Aviso tom="aviso">
              {pluralizar(semPersonagem, "fala está", "falas estão")} sem personagem vinculado e não
              serão destacadas para ninguém.
            </Aviso>
          </div>
        ) : null}

        <div className="grid gap-4 min-[900px]:grid-cols-[240px_1fr]">
          {/* Estrutura */}
          <Cartao className="h-fit px-3 py-3.5">
            <Eyebrow className="px-1">Estrutura</Eyebrow>
            <div className="mt-2.5 space-y-3">
              {atos.map((ato) => {
                const doAto = cenas.filter((c) => c.ato === ato);
                return (
                  <div key={ato}>
                    <p className="px-1 text-[13px] leading-5 font-bold text-ink-heading">
                      {rotuloAto(ato, doAto[0]?.atoTitulo)}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {doAto.map((cena) => {
                        const chave = `${cena.ato}-${cena.cena}`;
                        const foco = cenaFoco && `${cenaFoco.ato}-${cenaFoco.cena}` === chave;
                        return (
                          <li key={chave}>
                            <button
                              type="button"
                              onClick={() => setChaveFoco(chave)}
                              className={juntar(
                                "w-full rounded-[8px] px-2 py-1.5 text-left text-[13px] transition-colors",
                                foco
                                  ? "bg-brand/14 text-brand-strong"
                                  : "text-ink-caption hover:bg-surface-hover hover:text-ink-heading",
                              )}
                            >
                              {rotuloCena(cena.cena, cena.cenaTitulo)}
                              <span className="fonte-num ml-1.5 text-[11px] text-ink-caption">
                                {cena.falas.length}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
            <Divisor className="my-3" />
            <Botao
              variante="ghost"
              larguraTotal
              onClick={() => {
                definirErro(null);
                setNovaCena(true);
              }}
              className="gap-1.5"
            >
              <Plus size={15} />
              Adicionar cena
            </Botao>
          </Cartao>

          {/* Cena em edição */}
          <div>
            {!cenaFoco ? (
              <Vazio
                titulo="Roteiro vazio"
                descricao="Comece adicionando a primeira cena do Ato 1. Você pode registrar falas, narrações e indicações de cena."
                acao={<Botao onClick={() => setNovaCena(true)}>Adicionar cena</Botao>}
              />
            ) : (
              <>
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] leading-6 font-bold text-ink-heading">
                      {rotuloAto(cenaFoco.ato, cenaFoco.atoTitulo)} ·{" "}
                      {rotuloCena(cenaFoco.cena, cenaFoco.cenaTitulo)}
                    </h2>
                    <p className="text-[12px] leading-[18px] text-ink-caption">
                      {peca.roteiroPublicado
                        ? `Rascunho da versão ${peca.roteiroVersao + 1}`
                        : "Rascunho da versão 1"}{" "}
                      · última edição {editadoEm(peca.roteiroEditadoEm)}
                    </p>
                  </div>
                  <BotaoIcone
                    rotulo="Renomear ato e cena"
                    onClick={() => {
                      definirErro(null);
                      setRenomeando(true);
                    }}
                  >
                    <PencilSimple size={17} />
                  </BotaoIcone>
                </div>

                <ul className="space-y-2">
                  {cenaFoco.falas.map((fala, indice) => (
                    <li
                      key={fala.id}
                      className={juntar(
                        "rounded-[8px] border px-3 py-2.5",
                        fala.tipo === "acao"
                          ? "border-stroke-frame bg-surface-lower"
                          : "border-stroke-frame bg-surface-card",
                        fala.tipo === "fala" && !fala.characterId && "border-state-warning/50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-[150px] shrink-0 max-sm:w-[110px]">
                          {fala.tipo === "fala" ? (
                            <Selecao
                              value={fala.characterId ?? ""}
                              disabled={enviando}
                              onChange={(e) => void trocarPersonagem(fala, e.target.value)}
                              aria-label="Personagem da fala"
                              className="h-9 text-[13px]"
                            >
                              <option value="">Sem personagem</option>
                              {personagens.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome}
                                </option>
                              ))}
                            </Selecao>
                          ) : (
                            <p className="pt-2 text-[13px] leading-5 font-bold text-ink-caption">
                              {LINE_KIND_LABEL[fala.tipo]}
                            </p>
                          )}
                        </div>

                        <textarea
                          value={rascunhos[fala.id] ?? fala.texto}
                          onChange={(e) =>
                            setRascunhos((r) => ({ ...r, [fala.id]: e.target.value }))
                          }
                          onBlur={() => void gravarTexto(fala)}
                          rows={2}
                          className={juntar(
                            "min-h-9 w-full resize-y rounded-[8px] border border-transparent bg-transparent px-2 py-1.5 text-[14px] leading-[21px] text-ink-heading",
                            "hover:border-stroke-frame focus:border-brand focus:outline-none",
                            fala.tipo === "acao" && "text-ink-caption italic",
                          )}
                          aria-label="Texto da linha"
                        />

                        <div className="flex shrink-0 flex-col">
                          <BotaoIcone
                            rotulo="Mover para cima"
                            onClick={() => void mover(indice, -1)}
                            disabled={indice === 0 || enviando}
                            className="size-8"
                          >
                            <ArrowsDownUp size={15} className="rotate-180" />
                          </BotaoIcone>
                          <BotaoIcone
                            rotulo="Mover para baixo"
                            onClick={() => void mover(indice, 1)}
                            disabled={indice === cenaFoco.falas.length - 1 || enviando}
                            className="size-8"
                          >
                            <ArrowsDownUp size={15} />
                          </BotaoIcone>
                          <BotaoIcone
                            rotulo="Excluir linha"
                            onClick={() => void excluir(fala)}
                            disabled={enviando}
                            className="size-8 hover:text-[#e4796c]"
                          >
                            <Trash size={15} />
                          </BotaoIcone>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      definirErro(null);
                      setFormLinha({ characterId: "", texto: "" });
                      setNovaLinha("fala");
                    }}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-stroke-frame text-[13px] font-medium text-ink-caption transition-colors hover:border-brand hover:text-brand-strong"
                  >
                    <Plus size={15} />
                    Nova fala
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      definirErro(null);
                      setFormLinha({ characterId: "", texto: "" });
                      setNovaLinha("acao");
                    }}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-stroke-frame text-[13px] font-medium text-ink-caption transition-colors hover:border-brand hover:text-brand-strong"
                  >
                    <Plus size={15} />
                    Nova indicação de cena
                  </button>
                </div>

                <Cartao className="mt-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <p className="text-[13px] leading-5 text-ink-caption">
                    Ao publicar, os participantes passam a ver a versão{" "}
                    {peca.roteiroPublicado ? peca.roteiroVersao + 1 : 1} com as falas dos seus
                    personagens destacadas.
                  </p>
                  <Tag tom={vinculadas > 0 ? "positivo" : "neutro"}>
                    {vinculadas} falas vinculadas
                  </Tag>
                </Cartao>
              </>
            )}
          </div>
        </div>
      </CorpoAdmin>

      {/* Nova linha */}
      <Modal
        titulo={novaLinha === "acao" ? "Nova indicação de cena" : "Nova fala"}
        aberto={novaLinha !== null}
        onFechar={() => setNovaLinha(null)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setNovaLinha(null)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void adicionarLinha()} disabled={enviando}>
              {enviando ? "Salvando…" : "Adicionar"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3.5">
          {novaLinha === "fala" ? (
            <Campo
              etiqueta="Personagem"
              obrigatorio
              dica="É este vínculo que destaca a fala para o participante escalado."
            >
              <Selecao
                value={formLinha.characterId}
                onChange={(e) => setFormLinha({ ...formLinha, characterId: e.target.value })}
              >
                <option value="">Escolha o personagem</option>
                {personagens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          ) : null}

          <Campo etiqueta={novaLinha === "acao" ? "Indicação de cena" : "Texto da fala"} obrigatorio>
            <AreaTexto
              value={formLinha.texto}
              onChange={(e) => setFormLinha({ ...formLinha, texto: e.target.value })}
              placeholder={
                novaLinha === "acao"
                  ? "Ex.: A estrada, ao anoitecer. Míriam está junto ao portão."
                  : "Escreva o texto exatamente como deve ser dito."
              }
              className="min-h-[120px]"
            />
          </Campo>

          {novaLinha === "fala" ? (
            <p className="text-[12px] leading-[18px] text-ink-caption">
              Para narração, escolha o tipo depois na lista —{" "}
              {LINE_KINDS.map((k) => LINE_KIND_LABEL[k]).join(", ")} estão disponíveis.
            </p>
          ) : null}

          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>

      {/* Nova cena */}
      <FormularioNovaCena
        aberto={novaCena}
        onFechar={() => setNovaCena(false)}
        playId={id}
        personagens={personagens}
        cenas={cenas}
        onCriada={async (chave) => {
          setChaveFoco(chave);
          setNovaCena(false);
          await dados.recarregar();
        }}
      />

      {/* Renomear ato e cena */}
      {cenaFoco ? (
        <FormularioRenomear
          aberto={renomeando}
          onFechar={() => setRenomeando(false)}
          playId={id}
          cena={cenaFoco}
          onSalvo={async () => {
            setRenomeando(false);
            await dados.recarregar();
          }}
        />
      ) : null}

      {/* Publicação */}
      <Modal
        titulo="Publicar o roteiro?"
        aberto={publicando}
        onFechar={() => setPublicando(false)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setPublicando(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void publicar()} disabled={enviando}>
              {enviando ? "Publicando…" : "Publicar"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3 text-[14px] leading-[21px] text-ink-body">
          <p>
            O elenco passará a ler {pluralizar(falas.length, "linha", "linhas")} desta peça, com as
            falas de cada um destacadas.
          </p>
          {semPersonagem > 0 ? (
            <Aviso tom="aviso">
              {pluralizar(semPersonagem, "fala continua", "falas continuam")} sem personagem
              vinculado e não serão destacadas.
            </Aviso>
          ) : null}
          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>
    </>
  );
}

/**
 * Cria uma cena junto com a primeira linha dela. Atos e cenas existem através
 * das falas, então uma cena sem nenhuma linha não teria como ser guardada.
 */
function FormularioNovaCena({
  aberto,
  onFechar,
  playId,
  personagens,
  cenas,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  playId: string;
  personagens: Character[];
  cenas: Cena[];
  onCriada: (chave: string) => Promise<void>;
}) {
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const ultima = cenas[cenas.length - 1];
  const [form, setForm] = useState({
    ato: String(ultima?.ato ?? 1),
    atoTitulo: ultima?.atoTitulo ?? "",
    cena: String((ultima?.cena ?? 0) + 1),
    cenaTitulo: "",
    tipo: "acao" as LineKind,
    characterId: "",
    texto: "",
  });

  async function criar() {
    const ato = Number(form.ato);
    const cena = Number(form.cena);
    if (!Number.isInteger(ato) || ato < 1 || !Number.isInteger(cena) || cena < 1) {
      definirErro("Ato e cena precisam ser números a partir de 1.");
      return;
    }
    if (cenas.some((c) => c.ato === ato && c.cena === cena)) {
      definirErro("Essa cena já existe. Escolha outro número.");
      return;
    }
    if (!form.texto.trim()) {
      definirErro("Escreva a primeira linha da cena.");
      return;
    }
    if (form.tipo === "fala" && !form.characterId) {
      definirErro("Escolha o personagem da primeira fala.");
      return;
    }
    const personagem = personagens.find((p) => p.id === form.characterId) ?? null;
    const ok = await enviar(async () => {
      await criarFala(playId, {
        ato,
        atoTitulo: form.atoTitulo.trim(),
        cena,
        cenaTitulo: form.cenaTitulo.trim(),
        ordem: 0,
        tipo: form.tipo,
        characterId: form.tipo === "fala" ? form.characterId : null,
        characterNome: form.tipo === "fala" ? (personagem?.nome ?? "") : "",
        texto: form.texto.trim(),
      });
      await marcarRoteiroEditado(playId);
    });
    if (ok) await onCriada(`${ato}-${cena}`);
  }

  return (
    <Modal
      titulo="Adicionar cena"
      aberto={aberto}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="bare" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={() => void criar()} disabled={enviando}>
            {enviando ? "Criando…" : "Criar cena"}
          </Botao>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Ato" obrigatorio>
            <Entrada
              type="number"
              min={1}
              value={form.ato}
              onChange={(e) => setForm({ ...form, ato: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Título do ato">
            <Entrada
              value={form.atoTitulo}
              onChange={(e) => setForm({ ...form, atoTitulo: e.target.value })}
              placeholder="A espera"
            />
          </Campo>
          <Campo etiqueta="Cena" obrigatorio>
            <Entrada
              type="number"
              min={1}
              value={form.cena}
              onChange={(e) => setForm({ ...form, cena: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Título da cena">
            <Entrada
              value={form.cenaTitulo}
              onChange={(e) => setForm({ ...form, cenaTitulo: e.target.value })}
              placeholder="O retorno"
            />
          </Campo>
        </div>

        <Divisor />
        <p className="text-[12px] leading-[18px] text-ink-caption">
          Toda cena começa com uma primeira linha.
        </p>

        <Campo etiqueta="Tipo da primeira linha">
          <Selecao
            value={form.tipo}
            onChange={(e) =>
              setForm({
                ...form,
                tipo: e.target.value as LineKind,
                characterId: e.target.value === "fala" ? form.characterId : "",
              })
            }
          >
            {LINE_KINDS.map((k) => (
              <option key={k} value={k}>
                {LINE_KIND_LABEL[k]}
              </option>
            ))}
          </Selecao>
        </Campo>

        {form.tipo === "fala" ? (
          <Campo etiqueta="Personagem" obrigatorio>
            <Selecao
              value={form.characterId}
              onChange={(e) => setForm({ ...form, characterId: e.target.value })}
            >
              <option value="">Escolha o personagem</option>
              {personagens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
        ) : null}

        <Campo etiqueta="Texto" obrigatorio>
          <AreaTexto
            value={form.texto}
            onChange={(e) => setForm({ ...form, texto: e.target.value })}
            placeholder="Ex.: A estrada, ao anoitecer. Míriam está junto ao portão."
          />
        </Campo>

        {erro ? <Aviso>{erro}</Aviso> : null}
      </div>
    </Modal>
  );
}

/** Renomeia o ato e a cena em todas as linhas correspondentes. */
function FormularioRenomear({
  aberto,
  onFechar,
  playId,
  cena,
  onSalvo,
}: {
  aberto: boolean;
  onFechar: () => void;
  playId: string;
  cena: Cena;
  onSalvo: () => Promise<void>;
}) {
  const { enviando, erro, enviar } = useEnvio();
  const [atoTitulo, setAtoTitulo] = useState(cena.atoTitulo);
  const [cenaTitulo, setCenaTitulo] = useState(cena.cenaTitulo);

  async function salvar() {
    const ok = await enviar(async () => {
      await renomearCena(playId, cena.ato, cena.cena, {
        atoTitulo: atoTitulo.trim(),
        cenaTitulo: cenaTitulo.trim(),
      });
      await marcarRoteiroEditado(playId);
    });
    if (ok) await onSalvo();
  }

  return (
    <Modal
      titulo="Renomear ato e cena"
      aberto={aberto}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="bare" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar"}
          </Botao>
        </>
      }
    >
      <div className="space-y-3.5">
        <Campo etiqueta={`Título do Ato ${cena.ato}`} dica="Vale para todas as cenas deste ato.">
          <Entrada
            value={atoTitulo}
            onChange={(e) => setAtoTitulo(e.target.value)}
            placeholder="A espera"
          />
        </Campo>
        <Campo etiqueta={`Título da Cena ${cena.cena}`}>
          <Entrada
            value={cenaTitulo}
            onChange={(e) => setCenaTitulo(e.target.value)}
            placeholder="O retorno"
          />
        </Campo>
        {erro ? <Aviso>{erro}</Aviso> : null}
      </div>
    </Modal>
  );
}
