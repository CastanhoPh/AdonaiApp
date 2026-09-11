"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import {
  criarCaracteristica,
  criarPessoa,
  listarCaracteristicas,
  listarPecas,
  listarPersonagens,
  buscarCaracteristicasAtribuidas,
  comCaracteristicas,
  listarContas,
  listarPessoas,
  listarTodasParticipacoes,
} from "@/lib/db";
import { nomeCurto, normalizar, pluralizar } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import type { Character, Participation, Person, Play, Trait, UserAccount } from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import { VincularAcessos } from "@/components/admin/vincular-acessos";
import {
  Avatar,
  Aviso,
  Botao,
  Caixa,
  Campo,
  Cartao,
  Carregando,
  Divisor,
  Entrada,
  Modal,
  Selecao,
  Status,
  Tag,
  Vazio,
} from "@/components/ui";

interface Dados {
  pessoas: Person[];
  caracteristicas: Trait[];
  peca: Play | null;
  personagens: Character[];
  participacoes: Participation[];
  /** O papel mora na conta, não na ficha — é daqui que sai a marca "Direção". */
  contas: UserAccount[];
}

const FILTRO_PECAS = [
  { valor: "todas", rotulo: "Qualquer quantidade" },
  { valor: "0", rotulo: "Nenhuma peça" },
  { valor: "1-2", rotulo: "1 a 2 peças" },
  { valor: "3+", rotulo: "3 peças ou mais" },
] as const;

function pessoaVazia() {
  return {
    nome: "",
    email: "",
    telefone: "",
    ativo: true,
    caracteristicas: [] as string[],
  };
}

export default function Pessoas() {
  const dados = useCarregar<Dados>("admin-pessoas", async () => {
    /*
     * A peça atual vem da lista de peças, não de uma consulta própria.
     *
     * As duas devolvem o mesmo dado, mas a lista já foi baixada pelo
     * aquecimento da direção e volta do cache em disco; a consulta dedicada
     * (`atual == true`) tem chave só dela e, quando não existe peça atual,
     * responde vazia — e resposta vazia não dá para servir do disco, porque
     * não se distingue "sem peça" de "ainda não baixei". Era uma ida ao
     * servidor garantida a cada primeira visita desta tela.
     */
    const [pessoas, caracteristicas, pecas, participacoes, atribuidas, contas] =
      await Promise.all([
        listarPessoas(),
        listarCaracteristicas(),
        listarPecas(),
        listarTodasParticipacoes(),
        buscarCaracteristicasAtribuidas(),
        listarContas(),
      ]);
    const peca = pecas.find((p) => p.atual) ?? null;
    const personagens = peca ? await listarPersonagens(peca.id) : [];
    return {
      // Mesclado aqui: o documento da pessoa não guarda mais a avaliação.
      pessoas: comCaracteristicas(pessoas, atribuidas.pessoas, "caracteristicas"),
      caracteristicas,
      peca,
      personagens,
      participacoes,
      contas,
    };
  }, []);

  const [busca, setBusca] = useState("");
  const [filtroTrait, setFiltroTrait] = useState("todas");
  const [filtroPersonagem, setFiltroPersonagem] = useState("todos");
  const [filtroPecas, setFiltroPecas] = useState<string>("todas");
  /*
   * Abre em "somente ativos".
   *
   * "Ativa no grupo" significa "participa e usa o app"; quem entrou só pelo
   * acervo fica inativa, e hoje isso é a maioria do cadastro. O trabalho do dia
   * a dia — escalar, convocar, avisar — é com quem está ativo, e essas dezenas
   * de fichas antigas enterravam esse grupo no meio da lista.
   *
   * Elas não somem sem aviso: a contagem abaixo da barra de filtros diz quantas
   * estão escondidas, e o seletor ao lado traz todas de volta.
   */
  const [filtroSituacao, setFiltroSituacao] = useState("ativos");

  const [formAberto, setFormAberto] = useState(false);
  const [traitAberto, setTraitAberto] = useState(false);
  const [form, setForm] = useState(pessoaVazia());
  const [novaTrait, setNovaTrait] = useState("");
  const { enviando, erro, definirErro, enviar } = useEnvio();

  const pessoas = useMemo(() => dados.dados?.pessoas ?? [], [dados.dados]);
  const traits = dados.dados?.caracteristicas ?? [];

  /*
   * Quem é da direção.
   *
   * O papel é da conta de acesso, não da ficha, e as duas coisas se ligam por
   * `personId`. Sem esta lista a tela de Pessoas não tinha como mostrar quem
   * administra o app — a informação só aparecia entrando na ficha de cada um.
   */
  const ehDirecao = useMemo(() => {
    const ids = new Set<string>();
    for (const conta of dados.dados?.contas ?? []) {
      if (conta.role === "admin" && conta.personId) ids.add(conta.personId);
    }
    return ids;
  }, [dados.dados]);
  const personagens = useMemo(() => dados.dados?.personagens ?? [], [dados.dados]);
  const participacoes = useMemo(() => dados.dados?.participacoes ?? [], [dados.dados]);

  /** Personagem atual por pessoa e total de peças por pessoa. */
  const indice = useMemo(() => {
    const porPessoa = new Map<string, Character>();
    personagens.forEach((p) => {
      if (p.personId) porPessoa.set(p.personId, p);
    });
    const contagem = new Map<string, number>();
    participacoes.forEach((p) => contagem.set(p.personId, (contagem.get(p.personId) ?? 0) + 1));
    return { porPessoa, contagem };
  }, [personagens, participacoes]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    return pessoas.filter((pessoa) => {
      if (termo && !normalizar(pessoa.nome).includes(termo)) return false;
      if (filtroSituacao === "ativos" && !pessoa.ativo) return false;
      if (filtroSituacao === "inativos" && pessoa.ativo) return false;
      if (filtroTrait !== "todas" && !pessoa.caracteristicas?.includes(filtroTrait)) return false;

      const personagem = indice.porPessoa.get(pessoa.id);
      if (filtroPersonagem === "com" && !personagem) return false;
      if (filtroPersonagem === "sem" && personagem) return false;
      if (
        filtroPersonagem !== "todos" &&
        filtroPersonagem !== "com" &&
        filtroPersonagem !== "sem" &&
        personagem?.id !== filtroPersonagem
      )
        return false;

      const total = indice.contagem.get(pessoa.id) ?? 0;
      if (filtroPecas === "0" && total !== 0) return false;
      if (filtroPecas === "1-2" && (total < 1 || total > 2)) return false;
      if (filtroPecas === "3+" && total < 3) return false;

      return true;
    });
  }, [pessoas, busca, filtroSituacao, filtroTrait, filtroPersonagem, filtroPecas, indice]);

  function abrirCadastro() {
    setForm(pessoaVazia());
    definirErro(null);
    setFormAberto(true);
  }

  async function salvarPessoa() {
    if (!form.nome.trim()) {
      definirErro("Informe o nome.");
      return;
    }
    const ok = await enviar(async () => {
      await criarPessoa({
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        fotoUrl: "",
        ativo: form.ativo,
        caracteristicas: form.caracteristicas,
      });
      await dados.recarregar();
    });
    if (ok) setFormAberto(false);
  }

  async function salvarTrait() {
    if (!novaTrait.trim()) {
      definirErro("Informe o nome da característica.");
      return;
    }
    const ok = await enviar(async () => {
      await criarCaracteristica(novaTrait.trim(), traits.length);
      setNovaTrait("");
      await dados.recarregar();
    });
    if (ok) setTraitAberto(false);
  }

  // Grade da tabela: nome, personagem, peças, uma coluna por característica, situação.
  /*
   * A última coluna é mais larga que as outras: é a que acumula "Ativo" com
   * "Direção" e "Sem e-mail". Em 0.9fr as etiquetas quebravam para a linha de
   * baixo e só as linhas que as tinham ficavam mais altas, o que deixava a
   * tabela com um passo irregular.
   *
   * As colunas de característica têm `max-content` como piso: o nome da
   * característica é escolhido pela direção e pode ser longo — "Noção de
   * espaço" já não cabia e quebrava o cabeçalho em duas linhas. Com o piso, a
   * coluna acompanha o rótulo em vez de espremê-lo, seja qual for o nome.
   */
  const colunas = `1.6fr 1.4fr 0.7fr ${traits
    .map(() => "minmax(max-content, 0.9fr)")
    .join(" ")} 1.5fr`;
  const ativos = pessoas.filter((p) => p.ativo).length;

  return (
    <>
      <TopoAdmin
        titulo="Pessoas"
        subtitulo={`${pluralizar(ativos, "integrante ativo", "integrantes ativos")} · ${pessoas.length - ativos} inativos`}
        acoes={
          <>
            <Botao
              variante="ghost"
              onClick={() => {
                definirErro(null);
                setTraitAberto(true);
              }}
            >
              Características
            </Botao>
            <Botao onClick={abrirCadastro} className="gap-1.5">
              <Plus size={15} />
              Cadastrar pessoa
            </Botao>
          </>
        }
      />

      <CorpoAdmin>
        {/*
          * Fila de vínculos, fora do bloco de carregamento da lista: é
          * pendência de trabalho e aparece assim que existir, sem depender de
          * os filtros e a tabela terminarem de carregar.
          */}
        <VincularAcessos />

        {dados.carregando ? (
          <Carregando />
        ) : dados.erro ? (
          <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
        ) : (
          <div className="space-y-4">
            {/* Toolbar de filtros */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative w-[260px] max-sm:w-full">
                <MagnifyingGlass
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-caption"
                />
                <Entrada
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pelo nome"
                  className="pl-9"
                  aria-label="Buscar pelo nome"
                />
              </div>
              <div className="w-[190px] max-sm:w-full">
                <Selecao
                  value={filtroTrait}
                  onChange={(e) => setFiltroTrait(e.target.value)}
                  aria-label="Filtrar por característica"
                >
                  <option value="todas">Característica</option>
                  {traits.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div className="w-[190px] max-sm:w-full">
                <Selecao
                  value={filtroPersonagem}
                  onChange={(e) => setFiltroPersonagem(e.target.value)}
                  aria-label="Filtrar por personagem atual"
                >
                  <option value="todos">Personagem</option>
                  <option value="com">Escalados na peça atual</option>
                  <option value="sem">Sem personagem atual</option>
                  {personagens.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div className="w-[190px] max-sm:w-full">
                <Selecao
                  value={filtroPecas}
                  onChange={(e) => setFiltroPecas(e.target.value)}
                  aria-label="Filtrar por quantidade de peças"
                >
                  {FILTRO_PECAS.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div className="w-[170px] max-sm:w-full">
                <Selecao
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  aria-label="Filtrar por situação"
                >
                  <option value="todos">Ativos e inativos</option>
                  <option value="ativos">Somente ativos</option>
                  <option value="inativos">Somente inativos</option>
                </Selecao>
              </div>
            </div>

            {/*
              Quantas ficaram de fora.
              A tela abre filtrando por ativos, e sem esta linha as dezenas de
              fichas do acervo sumiriam em silêncio — quem procurasse alguém
              que já atuou concluiria que a pessoa não está cadastrada.
            */}
            {filtradas.length < pessoas.length ? (
              <p className="text-[12px] leading-[18px] text-ink-caption">
                Mostrando {filtradas.length} de {pessoas.length}.{" "}
                {filtroSituacao === "ativos" ? (
                  <button
                    type="button"
                    onClick={() => setFiltroSituacao("todos")}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    Ver também quem está inativo
                  </button>
                ) : null}
              </p>
            ) : null}

            {erro && !formAberto && !traitAberto ? <Aviso>{erro}</Aviso> : null}

            {filtradas.length === 0 ? (
              <Vazio
                titulo="Nenhuma pessoa encontrada"
                descricao={
                  pessoas.length === 0
                    ? "Cadastre os integrantes do teatro para começar a montar o elenco."
                    : "Nenhum integrante corresponde aos filtros escolhidos."
                }
                acao={
                  pessoas.length === 0 ? (
                    <Botao onClick={abrirCadastro}>Cadastrar pessoa</Botao>
                  ) : undefined
                }
              />
            ) : (
              <>
                {/* Tabela — telas largas */}
                <div className="overflow-hidden rounded-[16px] border border-stroke-frame max-[900px]:hidden">
                  <div className="overflow-x-auto">
                    {/*
                      `w-max` deixa a tabela crescer até a largura que as colunas
                      pedem, e `min-w-full` faz ela preencher o cartão quando
                      sobra espaço — só com `w-max` ficava uma faixa vazia à
                      direita, com o cabeçalho terminando antes da borda.
                    */}
                    <div className="w-max min-w-full">
                      <div
                        style={{ gridTemplateColumns: colunas }}
                        className="grid gap-3 border-b border-stroke-frame bg-surface-lower px-4 py-2.5"
                      >
                        {["Nome", "Personagem atual", "Peças", ...traits.map((t) => t.nome), "Situação"].map(
                          (rotulo, i) => (
                            <span
                              key={`${rotulo}-${i}`}
                              className="text-[11px] leading-4 tracking-wide whitespace-nowrap text-ink-caption uppercase"
                            >
                              {rotulo}
                            </span>
                          ),
                        )}
                      </div>

                      {filtradas.map((pessoa) => {
                        const personagem = indice.porPessoa.get(pessoa.id);
                        return (
                          <div
                            key={pessoa.id}
                            style={{ gridTemplateColumns: colunas }}
                            className="grid items-center gap-3 border-b border-stroke-list px-4 py-3 last:border-0 hover:bg-surface-hover"
                          >
                            <Link
                              href={`/admin/pessoas/detalhe?id=${pessoa.id}`}
                              className="flex min-w-0 items-center gap-2.5"
                            >
                              <Avatar nome={pessoa.nome} url={pessoa.fotoUrl} tamanho={28} />
                              <span className="truncate text-[14px] font-medium text-ink-heading hover:text-brand-strong">
                                {nomeCurto(pessoa.nome)}
                              </span>
                            </Link>
                            <span className="truncate text-[13px] text-ink-body">
                              {personagem ? personagem.nome : "Não escalado"}
                            </span>
                            <span className="fonte-num text-[13px] text-ink-body">
                              {indice.contagem.get(pessoa.id) ?? 0}
                            </span>
                            {traits.map((t) => (
                              <span key={t.id}>
                                {pessoa.caracteristicas?.includes(t.id) ? (
                                  <Check size={18} className="text-brand" />
                                ) : (
                                  <span className="text-ink-disabled">—</span>
                                )}
                              </span>
                            ))}
                            <span className="flex flex-wrap items-center gap-2">
                              <Status tom={pessoa.ativo ? "positivo" : "neutro"}>
                                {pessoa.ativo ? "Ativo" : "Inativo"}
                              </Status>
                              {/* Quem administra o app. Vem da conta, não da ficha. */}
                              {ehDirecao.has(pessoa.id) ? <Tag tom="areia">Direção</Tag> : null}
                              {/*
                                * Sem e-mail a pessoa nunca será encontrada
                                * quando criar a conta. Precisa ficar à vista,
                                * senão o vínculo não acontece por esquecimento.
                                */}
                              {!pessoa.email ? <Tag tom="aviso">Sem e-mail</Tag> : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cartões — telas estreitas */}
                <ul className="space-y-3 min-[900px]:hidden">
                  {filtradas.map((pessoa) => {
                    const personagem = indice.porPessoa.get(pessoa.id);
                    const marcadas = traits.filter((t) => pessoa.caracteristicas?.includes(t.id));
                    return (
                      <li key={pessoa.id}>
                        <Link href={`/admin/pessoas/detalhe?id=${pessoa.id}`} className="block">
                          <Cartao className="px-4 py-3.5 transition-colors hover:bg-surface-hover">
                            <div className="flex items-start gap-3">
                              <Avatar nome={pessoa.nome} url={pessoa.fotoUrl} tamanho={40} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] leading-[22px] font-bold text-ink-heading">
                                  {nomeCurto(pessoa.nome)}
                                </p>
                                <p className="text-[13px] leading-5 text-ink-caption">
                                  {personagem ? personagem.nome : "Não escalado"} ·{" "}
                                  {pluralizar(indice.contagem.get(pessoa.id) ?? 0, "peça", "peças")}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Status tom={pessoa.ativo ? "positivo" : "neutro"}>
                                    {pessoa.ativo ? "Ativo" : "Inativo"}
                                  </Status>
                                  {ehDirecao.has(pessoa.id) ? <Tag tom="areia">Direção</Tag> : null}
                                  {!pessoa.email ? <Tag tom="aviso">Sem e-mail</Tag> : null}
                                  {marcadas.map((t) => (
                                    <Tag key={t.id} tom="info">
                                      {t.nome}
                                    </Tag>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </Cartao>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </CorpoAdmin>

      {/* Cadastro de pessoa */}
      <Modal
        titulo="Cadastrar pessoa"
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setFormAberto(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void salvarPessoa()} disabled={enviando}>
              {enviando ? "Salvando…" : "Cadastrar"}
            </Botao>
          </>
        }
      >
        <div className="space-y-3.5">
          <Campo etiqueta="Nome completo" obrigatorio>
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome do integrante"
            />
          </Campo>
          {/*
            * E-mail deixou de ser exigido para o acervo antigo poder entrar:
            * quem atuou em 2024 pode não ter e-mail à mão, e travar o cadastro
            * nisso significa não registrar a peça. Sem e-mail a pessoa existe
            * e recebe histórico; só não é encontrada quando ela criar a conta,
            * até alguém preencher o campo.
            */}
          <Campo
            etiqueta="E-mail"
            dica="É ele que vincula a conta automaticamente quando a pessoa se cadastrar. Pode ficar em branco e ser preenchido depois."
          >
            <Entrada
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="integrante@exemplo.com"
            />
          </Campo>
          <Campo etiqueta="Telefone">
            <Entrada
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </Campo>
          {/*
            * Sem foto aqui de propósito: o arquivo mora em atores/{personId}/
            * no Storage, e o id só existe depois de salvar.
            */}
          <p className="text-[12px] leading-[18px] text-ink-caption">
            A foto é enviada depois de salvar, na tela da pessoa.
          </p>

          <div>
            <p className="mb-1.5 text-[12px] leading-[18px] text-ink-caption">
              Características de atuação
            </p>
            {traits.length === 0 ? (
              <p className="text-[13px] text-ink-caption">
                Nenhuma característica cadastrada ainda. Use o botão “Características”.
              </p>
            ) : (
              <div className="-mx-2">
                {traits.map((t) => (
                  <Caixa
                    key={t.id}
                    marcada={form.caracteristicas.includes(t.id)}
                    onClick={() =>
                      setForm({
                        ...form,
                        caracteristicas: form.caracteristicas.includes(t.id)
                          ? form.caracteristicas.filter((id) => id !== t.id)
                          : [...form.caracteristicas, t.id],
                      })
                    }
                  >
                    {t.nome}
                  </Caixa>
                ))}
              </div>
            )}
          </div>

          <Divisor />

          <div className="-mx-2">
            <Caixa marcada={form.ativo} onClick={() => setForm({ ...form, ativo: !form.ativo })}>
              Ativo no grupo
            </Caixa>
          </div>

          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>

      {/* Características */}
      <Modal
        titulo="Características de atuação"
        aberto={traitAberto}
        onFechar={() => setTraitAberto(false)}
        rodape={
          <Botao variante="bare" onClick={() => setTraitAberto(false)}>
            Fechar
          </Botao>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2.5 text-[13px] leading-5 text-ink-caption">
              As características marcadas no perfil de cada pessoa ajudam a escolher o elenco.
            </p>
            <div className="flex flex-wrap gap-2">
              {traits.length === 0 ? (
                <p className="text-[13px] text-ink-caption">Nenhuma característica cadastrada.</p>
              ) : (
                traits.map((t) => (
                  <Tag key={t.id} tom="info">
                    {t.nome}
                  </Tag>
                ))
              )}
            </div>
          </div>

          <Divisor />

          <Campo etiqueta="Nova característica">
            <Entrada
              value={novaTrait}
              onChange={(e) => setNovaTrait(e.target.value)}
              placeholder="Ex.: Boa memorização"
            />
          </Campo>
          {erro ? <Aviso>{erro}</Aviso> : null}
          <Botao onClick={() => void salvarTrait()} disabled={enviando} className="gap-1.5">
            <Plus size={15} />
            {enviando ? "Salvando…" : "Adicionar característica"}
          </Botao>
        </div>
      </Modal>
    </>
  );
}
