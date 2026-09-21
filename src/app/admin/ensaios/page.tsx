"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRinging, Plus } from "@phosphor-icons/react";
import {
  atualizarEnsaio,
  cenasDaPeca,
  criarEnsaio,
  listarEnsaios,
  listarIndisponibilidades,
  listarPecas,
  listarPersonagens,
  quemFalaNosTrechos,
  quemNaoPodeEm,
  removerEnsaio,
} from "@/lib/db";
import { dataLonga, hojeISO, nomeCurto, pluralizar } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  ENCONTRO_TIPOS,
  ENCONTRO_TIPO_LABEL,
  REHEARSAL_STATUS,
  REHEARSAL_STATUS_LABEL,
  type EncontroTipo,
  type Indisponibilidade,
  type Play,
  type Rehearsal,
  type RehearsalStatus,
  type TrechoDaPeca,
} from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import { CartaoEnsaio } from "@/components/comum/ensaio-cartao";
import { PresencasDoEnsaio } from "@/components/comum/presenca";
import {
  Abas,
  AreaTexto,
  Aviso,
  Botao,
  BotaoLink,
  Caixa,
  Campo,
  Carregando,
  Divisor,
  Entrada,
  Eyebrow,
  Modal,
  Selecao,
  Vazio,
  juntar,
} from "@/components/ui";

type Aba = "proximos" | "anteriores";

interface Dados {
  pecas: Play[];
  atual: Play | null;
  ensaios: Rehearsal[];
}

/** Pessoa escalada na peça, para a lista de convocação. */
interface Escalado {
  personId: string;
  nome: string;
  personagem: string;
}

/** Molde do formulário a partir de um ensaio já salvo. */
function formDoEnsaio(ensaio: Rehearsal) {
  return {
    playId: ensaio.playId,
    tipo: ensaio.tipo ?? ("ensaio" as EncontroTipo),
    nomeEvento: ensaio.nomeEvento ?? "",
    trechos: ensaio.trechos ?? [],
    data: ensaio.data,
    horaInicio: ensaio.horaInicio,
    horaFim: ensaio.horaFim,
    local: ensaio.local,
    todos: ensaio.todos,
    convocados: ensaio.convocados ?? [],
    observacoes: ensaio.observacoes ?? "",
    status: ensaio.status,
  };
}

function ensaioVazio(playId: string) {
  return {
    playId,
    tipo: "ensaio" as EncontroTipo,
    nomeEvento: "",
    trechos: [] as TrechoDaPeca[],
    data: "",
    horaInicio: "19:30",
    horaFim: "21:30",
    local: "",
    todos: true,
    convocados: [] as string[],
    observacoes: "",
    status: "agendado" as RehearsalStatus,
  };
}

export default function EnsaiosAdmin() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      }
    >
      <ConteudoEnsaios />
    </Suspense>
  );
}

function ConteudoEnsaios() {
  const consulta = useSearchParams();
  const dados = useCarregar<Dados>("admin-ensaios", async () => {
    /*
     * A peça atual sai da própria lista, em vez de uma consulta dedicada: esta
     * tela já baixa todas as peças, então perguntar de novo ao servidor qual é
     * a atual era uma ida e volta a mais por um dado que já estava na mão.
     */
    const [pecas, ensaios] = await Promise.all([listarPecas(), listarEnsaios()]);
    return { pecas, atual: pecas.find((p) => p.atual) ?? null, ensaios };
  }, []);

  const { enviando, erro, definirErro, enviar } = useEnvio();

  /*
   * `?novo=1` já chega com o formulário aberto — mesmo motivo das peças: o
   * atalho "Novo ensaio" do Painel só trazia até esta lista, obrigando a clicar
   * no mesmo botão outra vez. Estado derivado do parâmetro (`null` = ninguém
   * mexeu ainda) para não perder o pedido quando `useSearchParams` chega vazio
   * no primeiro render da exportação estática.
   */
  const [abertoManual, setAbertoManual] = useState<boolean | null>(null);
  /*
   * `?abrir=<id>` abre direto o ensaio pedido — "Abrir ensaio", no Painel, só
   * levava até esta lista sem abrir nada.
   *
   * O ensaio só existe depois de a consulta responder, o que pediria um efeito
   * para semear o formulário. Em vez disso o estado guarda apenas as
   * *alterações*: `form` é o ensaio pedido com as edições por cima, e
   * `editandoId` só sai do que a URL diz quando alguém mexe (`undefined` =
   * ninguém mexeu). Assim nada precisa de efeito e o formulário se preenche
   * sozinho quando os dados chegam.
   */
  const [editandoManual, setEditandoManual] = useState<string | null | undefined>(undefined);
  const [alteracoes, setAlteracoes] = useState<ReturnType<typeof ensaioVazio> | null>(null);
  const [removendo, setRemovendo] = useState<Rehearsal | null>(null);
  /*
   * `?peca=<id>` já chega filtrado: o botão "Ensaios" da tela da peça levava à
   * lista inteira, misturando os ensaios de todas as peças.
   */
  const [filtroPecaManual, setFiltroPecaManual] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("proximos");

  const pecas = dados.dados?.pecas ?? [];

  /*
   * Sem peça cadastrada o formulário não tem o que preencher, então o atalho só
   * abre quando existe peça — a tela já explica que a peça vem primeiro.
   */
  const filtroPeca = filtroPecaManual ?? consulta.get("peca") ?? "todas";
  const ensaios = useMemo(() => dados.dados?.ensaios ?? [], [dados.dados]);
  const hoje = hojeISO();

  const idAbrir = consulta.get("abrir");
  const editandoId = editandoManual !== undefined ? editandoManual : (idAbrir ?? null);
  const ensaioAberto = editandoId ? (ensaios.find((e) => e.id === editandoId) ?? null) : null;

  /*
   * Sem peça cadastrada o formulário não tem o que preencher, então o atalho de
   * novo ensaio só abre quando existe peça — a tela já explica que a peça vem
   * primeiro. `?abrir` só abre quando o ensaio pedido realmente existe.
   */
  const aberto =
    abertoManual ??
    ((consulta.get("novo") === "1" && pecas.length > 0) || ensaioAberto !== null);

  const form = alteracoes ?? (ensaioAberto ? formDoEnsaio(ensaioAberto) : ensaioVazio(""));

  /*
   * Aberto pelo atalho de novo ensaio, o formulário nasceu sem peça: a peça
   * atual (ou a primeira da lista) entra como padrão aqui, já que na montagem
   * as peças ainda não tinham chegado.
   */
  const playId = editandoId
    ? form.playId
    : form.playId || dados.dados?.atual?.id || pecas[0]?.id || "";

  // Elenco da peça escolhida no formulário.
  const elenco = useCarregar<Escalado[]>("admin-ensaios-elenco", async () => {
    if (!aberto || !playId) return [];
    const personagens = await listarPersonagens(playId);
    return personagens
      .filter((p) => p.personId)
      .map((p) => ({
        personId: p.personId as string,
        nome: p.personNome,
        personagem: p.nome,
      }));
  }, [aberto, playId]);
  const escalados = useMemo(() => elenco.dados ?? [], [elenco.dados]);

  /*
   * As cenas da peça e quem já avisou que não pode.
   *
   * Vêm juntas e só com o formulário aberto: são as duas coisas que a direção
   * precisa no momento de marcar, e nenhuma faz falta enquanto ela só olha a
   * lista.
   */
  const paraMarcar = useCarregar<{ cenas: TrechoDaPeca[]; avisos: Indisponibilidade[] }>(
    "admin-ensaios-marcar",
    async () => {
      if (!aberto || !playId) return { cenas: [], avisos: [] };
      const [cenas, avisos] = await Promise.all([
        cenasDaPeca(playId),
        listarIndisponibilidades(hoje),
      ]);
      return { cenas, avisos };
    },
    [aberto, playId, hoje],
  );
  const cenas = paraMarcar.dados?.cenas ?? [];
  const avisos = useMemo(() => paraMarcar.dados?.avisos ?? [], [paraMarcar.dados]);

  /** Quem avisou que não pode no dia escolhido, entre os convocados. */
  const naoPodem = useMemo(() => {
    if (!form.data) return [];
    const doDia = quemNaoPodeEm(avisos, form.data);
    const convocados = new Set(form.todos ? escalados.map((p) => p.personId) : form.convocados);
    return doDia.filter((a) => convocados.has(a.personId));
  }, [avisos, form.data, form.todos, form.convocados, escalados]);

  function alternarTrecho(trecho: TrechoDaPeca) {
    const chave = `${trecho.ato}-${trecho.cena}`;
    const tem = form.trechos.some((t) => `${t.ato}-${t.cena}` === chave);
    setAlteracoes({
      ...form,
      trechos: tem
        ? form.trechos.filter((t) => `${t.ato}-${t.cena}` !== chave)
        : [...form.trechos, trecho].sort((a, b) => a.ato - b.ato || a.cena - b.cena),
    });
  }

  /**
   * Convoca quem fala nos trechos escolhidos.
   *
   * Sem isto, marcar um ensaio de uma cena e chamar o elenco inteiro é o
   * caminho mais curto — conferir no roteiro quem fala ali dá mais trabalho
   * que chamar todos —, e aí quinze pessoas atravessam a cidade para assistir
   * a três ensaiarem.
   */
  async function convocarPelosTrechos() {
    if (!playId || form.trechos.length === 0) return;
    await enviar(async () => {
      const pessoas = await quemFalaNosTrechos(playId, form.trechos);
      const noElenco = new Set(escalados.map((p) => p.personId));
      setAlteracoes({
        ...form,
        todos: false,
        convocados: pessoas.filter((id) => noElenco.has(id)),
      });
    });
  }

  const visiveis = useMemo(
    () => (filtroPeca === "todas" ? ensaios : ensaios.filter((e) => e.playId === filtroPeca)),
    [ensaios, filtroPeca],
  );
  const proximos = visiveis.filter((e) => e.data >= hoje);
  const anteriores = visiveis.filter((e) => e.data < hoje).reverse();
  const lista = aba === "proximos" ? proximos : anteriores;

  function abrirNovo() {
    setEditandoManual(null);
    setAlteracoes(ensaioVazio(dados.dados?.atual?.id ?? pecas[0]?.id ?? ""));
    definirErro(null);
    setAbertoManual(true);
  }

  function abrirEdicao(ensaio: Rehearsal) {
    setEditandoManual(ensaio.id);
    setAlteracoes(formDoEnsaio(ensaio));
    definirErro(null);
    setAbertoManual(true);
  }

  async function salvar() {
    const oQueE = ENCONTRO_TIPO_LABEL[form.tipo].toLowerCase();
    if (!playId) {
      definirErro(`Escolha a peça d${form.tipo === "ensaio" ? "o" : "a"} ${oQueE}.`);
      return;
    }
    if (!form.data) {
      definirErro(`Informe a data d${form.tipo === "ensaio" ? "o" : "a"} ${oQueE}.`);
      return;
    }
    if (!form.horaInicio) {
      definirErro("Informe o horário de início.");
      return;
    }
    if (!form.todos && form.convocados.length === 0) {
      definirErro("Selecione pelo menos uma pessoa convocada ou convoque todo o elenco.");
      return;
    }

    const peca = pecas.find((p) => p.id === playId);
    const conteudo = {
      playId,
      playTitulo: peca?.titulo ?? "",
      tipo: form.tipo,
      // Só apresentação carrega evento; ensaio com nome de evento confundiria
      // a lista, que usa esse campo para dizer onde a peça subiu.
      nomeEvento: form.tipo === "apresentacao" ? form.nomeEvento.trim() : "",
      // Vazio significa "a peça inteira", e é o que uma apresentação sempre é.
      trechos: form.tipo === "apresentacao" ? [] : form.trechos,
      data: form.data,
      horaInicio: form.horaInicio,
      horaFim: form.horaFim,
      local: form.local.trim(),
      todos: form.todos,
      convocados: form.todos ? [] : form.convocados,
      observacoes: form.observacoes.trim(),
      status: form.status,
    };

    const ok = await enviar(async () => {
      if (editandoId) await atualizarEnsaio(editandoId, conteudo);
      else await criarEnsaio(conteudo);
      await dados.recarregar();
    });
    if (ok) setAbertoManual(false);
  }

  async function remover() {
    if (!removendo) return;
    const alvo = removendo;
    const ok = await enviar(async () => {
      await removerEnsaio(alvo.id);
      await dados.recarregar();
    });
    if (ok) setRemovendo(null);
  }

  function detalheConvocados(ensaio: Rehearsal): string {
    return ensaio.todos
      ? "Todo o elenco convocado"
      : pluralizar(ensaio.convocados.length, "pessoa convocada", "pessoas convocadas");
  }

  return (
    <>
      <TopoAdmin
        titulo="Ensaios"
        subtitulo="Datas, locais e convocações. Os mais próximos aparecem primeiro."
        acoes={
          <Botao onClick={abrirNovo} disabled={pecas.length === 0} className="gap-1.5">
            <Plus size={15} />
            Novo ensaio
          </Botao>
        }
      />

      <CorpoAdmin>
        {dados.carregando ? (
          <Carregando />
        ) : dados.erro ? (
          <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
        ) : pecas.length === 0 ? (
          <Vazio
            titulo="Cadastre uma peça primeiro"
            descricao="Todo ensaio está ligado a uma peça. Crie a peça e volte aqui para marcar os ensaios."
          />
        ) : (
          <div className="space-y-4">
            <div className="w-[280px] max-sm:w-full">
              <Selecao
                value={filtroPeca}
                onChange={(e) => setFiltroPecaManual(e.target.value)}
                aria-label="Filtrar por peça"
              >
                <option value="todas">Todas as peças</option>
                {pecas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                    {p.atual ? " (atual)" : ""}
                  </option>
                ))}
              </Selecao>
            </div>

            {erro && !aberto && !removendo ? <Aviso>{erro}</Aviso> : null}

            <Abas
              abas={[
                { chave: "proximos", rotulo: "Próximos", contagem: proximos.length },
                { chave: "anteriores", rotulo: "Anteriores", contagem: anteriores.length },
              ]}
              ativa={aba}
              onTrocar={setAba}
            />

            {lista.length === 0 ? (
              <Vazio
                titulo={aba === "proximos" ? "Nenhum ensaio agendado" : "Nenhum ensaio anterior"}
                descricao={
                  aba === "proximos"
                    ? "Marque o próximo ensaio para avisar o elenco."
                    : "Os ensaios já realizados aparecem aqui."
                }
                acao={aba === "proximos" ? <Botao onClick={abrirNovo}>Novo ensaio</Botao> : undefined}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {lista.map((ensaio, indice) => (
                  <CartaoEnsaio
                    key={ensaio.id}
                    ensaio={ensaio}
                    mostrarPeca
                    destaque={aba === "proximos" && indice === 0}
                    detalheConvocados={detalheConvocados(ensaio)}
                    acoes={
                      <>
                        <PresencasDoEnsaio ensaio={ensaio} />
                        {aba === "proximos" ? (
                          <BotaoLink
                            href={`/admin/avisos?ensaio=${ensaio.id}`}
                            variante="ghost"
                            className="gap-1.5"
                          >
                            <BellRinging size={15} />
                            Avisar convocados
                          </BotaoLink>
                        ) : null}
                        <Botao variante="ghost" onClick={() => abrirEdicao(ensaio)}>
                          Editar
                        </Botao>
                        <Botao variante="perigo" onClick={() => setRemovendo(ensaio)}>
                          Remover
                        </Botao>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CorpoAdmin>

      {/* Formulário em duas colunas: dados do ensaio e convocação */}
      <Modal
        titulo={editandoId ? "Editar ensaio" : "Novo ensaio"}
        aberto={aberto}
        onFechar={() => setAbertoManual(false)}
        largura="lg"
        rodape={
          <>
            <Botao variante="bare" onClick={() => setAbertoManual(false)}>
              Cancelar
            </Botao>
            <Botao onClick={() => void salvar()} disabled={enviando}>
              {enviando ? "Salvando…" : editandoId ? "Salvar ensaio" : "Criar ensaio"}
            </Botao>
          </>
        }
      >
        <div className="grid gap-5 min-[720px]:grid-cols-2">
          <div className="space-y-3.5">
            <Campo
              etiqueta="O que é"
              dica="Apresentação usa a mesma convocação e a mesma confirmação de presença do ensaio."
            >
              <Selecao
                value={form.tipo}
                onChange={(e) =>
                  setAlteracoes({
                    ...form,
                    tipo: e.target.value as EncontroTipo,
                    // Apresentação é a peça inteira, sempre.
                    trechos: e.target.value === "apresentacao" ? [] : form.trechos,
                  })
                }
              >
                {ENCONTRO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {ENCONTRO_TIPO_LABEL[t]}
                  </option>
                ))}
              </Selecao>
            </Campo>

            {form.tipo === "apresentacao" ? (
              <Campo etiqueta="Evento" dica="Onde a peça sobe: “Culto de Natal”, “Congresso de Jovens”.">
                <Entrada
                  value={form.nomeEvento}
                  onChange={(e) => setAlteracoes({ ...form, nomeEvento: e.target.value })}
                  placeholder="Culto de Natal"
                />
              </Campo>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Data" obrigatorio>
                <Entrada
                  type="date"
                  value={form.data}
                  onChange={(e) => setAlteracoes({ ...form, data: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Peça" obrigatorio>
                <Selecao
                  value={playId}
                  onChange={(e) => setAlteracoes({ ...form, playId: e.target.value, convocados: [] })}
                >
                  {pecas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.titulo}
                      {p.atual ? " (atual)" : ""}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo etiqueta="Início" obrigatorio>
                <Entrada
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => setAlteracoes({ ...form, horaInicio: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Término">
                <Entrada
                  type="time"
                  value={form.horaFim}
                  onChange={(e) => setAlteracoes({ ...form, horaFim: e.target.value })}
                />
              </Campo>
            </div>

            <Campo etiqueta="Local">
              <Entrada
                value={form.local}
                onChange={(e) => setAlteracoes({ ...form, local: e.target.value })}
                placeholder="Templo sede · salão principal"
              />
            </Campo>

            <Campo etiqueta="Status">
              <Selecao
                value={form.status}
                onChange={(e) => setAlteracoes({ ...form, status: e.target.value as RehearsalStatus })}
              >
                {REHEARSAL_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {REHEARSAL_STATUS_LABEL[s]}
                  </option>
                ))}
              </Selecao>
            </Campo>

            <Campo etiqueta="Observações">
              <AreaTexto
                value={form.observacoes}
                onChange={(e) => setAlteracoes({ ...form, observacoes: e.target.value })}
                placeholder="Ex.: leitura do Ato II com marcação de palco."
              />
            </Campo>
          </div>

          <div>
            {form.tipo === "ensaio" ? (
              <div className="mb-4">
                <Eyebrow>O que vai ser ensaiado</Eyebrow>
                <p className="mt-1.5 mb-2.5 text-[13px] leading-5 text-ink-caption">
                  {cenas.length === 0
                    ? "O roteiro desta peça ainda não tem cenas publicadas."
                    : form.trechos.length === 0
                      ? "Nenhuma cena marcada — vale como ensaio da peça inteira."
                      : `${pluralizar(form.trechos.length, "cena", "cenas")} de ${cenas.length}`}
                </p>
                {cenas.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {cenas.map((cena) => {
                        const marcada = form.trechos.some(
                          (t) => t.ato === cena.ato && t.cena === cena.cena,
                        );
                        return (
                          <button
                            key={`${cena.ato}-${cena.cena}`}
                            type="button"
                            onClick={() => alternarTrecho(cena)}
                            aria-pressed={marcada}
                            className={juntar(
                              "rounded-full border px-2.5 py-1 text-[12px] leading-4 transition-colors",
                              marcada
                                ? "border-brand bg-brand font-medium text-brand-ink"
                                : "border-stroke-frame text-ink-body hover:bg-surface-hover",
                            )}
                          >
                            {cena.ato}·{cena.cena}
                          </button>
                        );
                      })}
                    </div>
                    {form.trechos.length > 0 ? (
                      <Botao
                        variante="ghost"
                        className="mt-2.5 h-8"
                        onClick={() => void convocarPelosTrechos()}
                        disabled={enviando}
                      >
                        Convocar quem fala nessas cenas
                      </Botao>
                    ) : null}
                  </>
                ) : null}
                <Divisor className="my-3" />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Eyebrow>Convocação</Eyebrow>
              <button
                type="button"
                onClick={() =>
                  setAlteracoes({
                    ...form,
                    todos: false,
                    convocados:
                      form.convocados.length === escalados.length
                        ? []
                        : escalados.map((p) => p.personId),
                  })
                }
                className="text-[12px] font-medium text-brand-strong hover:underline"
              >
                {form.convocados.length === escalados.length && escalados.length > 0
                  ? "Limpar seleção"
                  : "Selecionar todos"}
              </button>
            </div>

            <p className="mt-1.5 text-[13px] leading-5 text-ink-caption">
              {form.todos
                ? `Todo o elenco (${escalados.length}) será convocado`
                : `${form.convocados.length} de ${escalados.length} selecionados`}
            </p>

            <div className="mt-2.5 -mx-2">
              <Caixa
                marcada={form.todos}
                onClick={() => setAlteracoes({ ...form, todos: !form.todos, convocados: [] })}
                descricao="Ao desmarcar, escolha as pessoas uma a uma."
              >
                Convocar todo o elenco
              </Caixa>
            </div>

            {naoPodem.length > 0 ? (
              <div className="mt-3">
                <Aviso tom="aviso">
                  {naoPodem.length === 1
                    ? `${nomeCurto(naoPodem[0].personNome)} avisou que não pode neste dia`
                    : `${naoPodem.length} convocados avisaram que não podem neste dia`}
                  {naoPodem.some((a) => a.motivo) ? (
                    <span className="mt-1 block text-[12px] leading-[18px]">
                      {naoPodem
                        .filter((a) => a.motivo)
                        .map((a) => `${nomeCurto(a.personNome)}: ${a.motivo}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Aviso>
              </div>
            ) : null}

            <Divisor className="my-3" />

            {form.todos ? (
              <p className="text-[13px] leading-5 text-ink-caption">
                Todos os escalados na peça aparecem como convocados.
              </p>
            ) : elenco.carregando || elenco.atualizando ? (
              <p className="text-[13px] leading-5 text-ink-caption">Carregando o elenco…</p>
            ) : escalados.length === 0 ? (
              <p className="text-[13px] leading-5 text-ink-caption">
                Nenhuma pessoa escalada nesta peça. Monte o elenco antes de convocar
                individualmente.
              </p>
            ) : (
              <div className="-mx-2 max-h-[280px] overflow-y-auto">
                {escalados.map((pessoa) => (
                  <Caixa
                    key={pessoa.personId}
                    marcada={form.convocados.includes(pessoa.personId)}
                    descricao={pessoa.personagem}
                    onClick={() =>
                      setAlteracoes({
                        ...form,
                        convocados: form.convocados.includes(pessoa.personId)
                          ? form.convocados.filter((x) => x !== pessoa.personId)
                          : [...form.convocados, pessoa.personId],
                      })
                    }
                  >
                    {pessoa.nome ? nomeCurto(pessoa.nome) : pessoa.personagem}
                  </Caixa>
                ))}
              </div>
            )}
          </div>
        </div>

        {erro ? (
          <div className="mt-4">
            <Aviso>{erro}</Aviso>
          </div>
        ) : null}
      </Modal>

      <Modal
        titulo="Remover ensaio?"
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
          <p>O ensaio de {dataLonga(removendo?.data ?? "")} será apagado.</p>
          <Aviso tom="aviso">
            Se o ensaio apenas não vai acontecer, prefira editá-lo e marcar o status como
            “Cancelado” — assim o elenco fica sabendo.
          </Aviso>
          {erro ? <Aviso>{erro}</Aviso> : null}
        </div>
      </Modal>
    </>
  );
}
