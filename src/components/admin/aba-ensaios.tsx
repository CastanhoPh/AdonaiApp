"use client";

import { useMemo, useState } from "react";
import { BellRinging, Plus } from "@phosphor-icons/react";
import {
  atualizarEnsaio,
  criarEnsaio,
  listarEnsaios,
  listarPecas,
  listarPersonagens,
  removerEnsaio,
} from "@/lib/db";
import { dataLonga, hojeISO, nomeCurto, pluralizar } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  REHEARSAL_STATUS,
  REHEARSAL_STATUS_LABEL,
  type Play,
  type Rehearsal,
  type RehearsalStatus,
} from "@/lib/types";
import { ErroCarregamento } from "@/components/shell";
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

/**
 * Ensaios de uma peça, embutido como aba dela.
 *
 * A tela de /admin/ensaios continua existindo, pelo menu lateral, e mostra os
 * ensaios de todas as peças. Aqui `playId` fixa o recorte: quem está dentro da
 * peça não deveria ver ensaio de outra, então o seletor de peça da tela solta
 * não aparece — e o ensaio novo já nasce ligado a esta peça.
 */
export function AbaEnsaios({ playId: pecaDaAba }: { playId: string }) {
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
   * mexeu ainda) — mesma forma da tela solta, de onde este componente veio.
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
  // Recorte fixo na peça da aba; não há seletor para trocar.
  const [aba, setAba] = useState<Aba>("proximos");

  const pecas = dados.dados?.pecas ?? [];

  /*
   * Sem peça cadastrada o formulário não tem o que preencher, então o atalho só
   * abre quando existe peça — a tela já explica que a peça vem primeiro.
   */
  const filtroPeca = pecaDaAba;
  const ensaios = useMemo(() => dados.dados?.ensaios ?? [], [dados.dados]);
  const hoje = hojeISO();

  const editandoId = editandoManual ?? null;
  const ensaioAberto = editandoId ? (ensaios.find((e) => e.id === editandoId) ?? null) : null;

  const aberto = abertoManual ?? false;

  const form = alteracoes ?? (ensaioAberto ? formDoEnsaio(ensaioAberto) : ensaioVazio(""));

  /*
   * Aberto pelo atalho de novo ensaio, o formulário nasceu sem peça: a peça
   * atual (ou a primeira da lista) entra como padrão aqui, já que na montagem
   * as peças ainda não tinham chegado.
   */
  // Dentro da aba, ensaio sem peça definida é sempre desta peça.
  const playId = editandoId ? form.playId : form.playId || pecaDaAba;

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
  const escalados = elenco.dados ?? [];

  const visiveis = useMemo(
    () => (filtroPeca === "todas" ? ensaios : ensaios.filter((e) => e.playId === filtroPeca)),
    [ensaios, filtroPeca],
  );
  const proximos = visiveis.filter((e) => e.data >= hoje);
  const anteriores = visiveis.filter((e) => e.data < hoje).reverse();
  const lista = aba === "proximos" ? proximos : anteriores;

  function abrirNovo() {
    setEditandoManual(null);
    setAlteracoes(ensaioVazio(pecaDaAba));
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
    if (!playId) {
      definirErro("Escolha a peça relacionada ao ensaio.");
      return;
    }
    if (!form.data) {
      definirErro("Informe a data do ensaio.");
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-ink-caption">
          Datas, locais e convocações desta peça. Os mais próximos aparecem primeiro.
        </p>
        <Botao onClick={abrirNovo} disabled={pecas.length === 0} className="gap-1.5">
          <Plus size={15} />
          Novo ensaio
        </Botao>
      </div>

      <div>
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
      </div>

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
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Data" obrigatorio>
                <Entrada
                  type="date"
                  value={form.data}
                  onChange={(e) => setAlteracoes({ ...form, data: e.target.value })}
                />
              </Campo>
              {/*
                * Peça fixa, não escolhida: o ensaio pertence à peça da aba.
                * Um seletor aqui deixaria criar ensaio de outra peça de dentro
                * desta, e ele desapareceria da lista no mesmo instante.
                */}
              <Campo etiqueta="Peça">
                <p className="flex h-11 items-center px-0.5 text-[14px] text-ink-heading">
                  {pecas.find((p) => p.id === playId)?.titulo ?? "—"}
                </p>
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
