"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Eye, EyeSlash, MagnifyingGlass, TextAa, X } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { listarFalas } from "@/lib/db";
import { dataCurta, nomesDaFala, normalizar, rotuloCena } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import { useAtual } from "@/lib/uso-atual";
import type { ScriptLine } from "@/lib/types";
import { ErroCarregamento, TopoAba } from "@/components/shell";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import { TrocarPeca } from "@/components/comum/trocar-peca";
import {
  Abas,
  Botao,
  BotaoIcone,
  Cartao,
  Carregando,
  Entrada,
  Tag,
  Vazio,
  juntar,
} from "@/components/ui";

interface Cena {
  cena: number;
  titulo: string;
  falas: ScriptLine[];
}
interface Ato {
  ato: number;
  titulo: string;
  cenas: Cena[];
}

/** Agrupa as falas, já ordenadas, em atos e cenas. */
function agrupar(falas: ScriptLine[]): Ato[] {
  const atos: Ato[] = [];
  for (const fala of falas) {
    let ato = atos.find((a) => a.ato === fala.ato);
    if (!ato) {
      ato = { ato: fala.ato, titulo: fala.atoTitulo ?? "", cenas: [] };
      atos.push(ato);
    }
    if (!ato.titulo && fala.atoTitulo) ato.titulo = fala.atoTitulo;
    let cena = ato.cenas.find((c) => c.cena === fala.cena);
    if (!cena) {
      cena = { cena: fala.cena, titulo: fala.cenaTitulo ?? "", falas: [] };
      ato.cenas.push(cena);
    }
    if (!cena.titulo && fala.cenaTitulo) cena.titulo = fala.cenaTitulo;
    cena.falas.push(fala);
  }
  return atos;
}

const TAMANHOS = ["0.9375rem", "1rem", "1.125rem", "1.25rem"];

/**
 * O tamanho escolhido fica no aparelho.
 *
 * É escolha de quem lê, não da conta: quem aumenta a letra faz isso por causa
 * da luz do ensaio e do tamanho da tela daquele celular, não porque quer letra
 * grande em todo lugar. Por isso `localStorage` e não a ficha.
 *
 * Sem isto a escolha durava até sair da tela — e o roteiro é justamente a tela
 * que se abre e fecha o tempo todo durante um ensaio, refazendo o ajuste toda
 * vez, no escuro.
 */
const CHAVE_DO_TAMANHO = "adonai:roteiro:tamanho";

function tamanhoGuardado(): number {
  if (typeof window === "undefined") return 1;
  try {
    const guardado = Number(window.localStorage.getItem(CHAVE_DO_TAMANHO));
    return Number.isInteger(guardado) && guardado >= 0 && guardado < TAMANHOS.length
      ? guardado
      : 1;
  } catch {
    // Navegação privada ou armazenamento bloqueado: começa no padrão.
    return 1;
  }
}

/*
 * Uma memória fora do React, com assinatura.
 *
 * `useState` mais `useEffect` seria o caminho curto e é proibido aqui: o
 * compilador do React recusa `setState` dentro de efeito, e com razão — o
 * primeiro desenho sairia com o padrão e o segundo com o guardado, piscando.
 * Ler `localStorage` direto no estado inicial também não serve: o app é
 * exportado estático, e o valor lido divergiria da pré-renderização, que é
 * erro de hidratação.
 *
 * `useSyncExternalStore` resolve os dois: o React pergunta o valor na hora
 * certa, e recebe 1 quando não há navegador.
 */
let escolhido: number | null = null;
const ouvintes = new Set<() => void>();

function lerTamanho(): number {
  if (escolhido === null) escolhido = tamanhoGuardado();
  return escolhido;
}

function assinarTamanho(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

function noServidor(): number {
  return 1;
}

function guardarTamanho(indice: number): void {
  escolhido = indice;
  try {
    window.localStorage.setItem(CHAVE_DO_TAMANHO, String(indice));
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão; não é motivo de erro.
  }
  ouvintes.forEach((avisar) => avisar());
}

export default function Roteiro() {
  const { pessoa } = useAuth();
  const atual = useAtual();
  const peca = atual.dados?.peca ?? null;
  /*
   * O destaque das falas considera todos os papéis da pessoa na peça: quem faz
   * três personagens precisa ver as falas dos três em destaque, não de um.
   */
  const personagens = atual.dados?.personagens;
  /*
   * Memorizado porque entra nas dependências do índice de falas abaixo: um Set
   * novo a cada render faria o índice inteiro ser recalculado sem necessidade.
   */
  const meusIds = useMemo(
    () => new Set((personagens ?? []).map((p) => p.id)),
    [personagens],
  );
  const personagem = personagens?.[0] ?? null;

  const falas = useCarregar<ScriptLine[]>("roteiro-falas",
    async () => (peca ? listarFalas(peca.id) : []),
    [peca?.id],
  );

  const lista = useMemo(() => falas.dados ?? [], [falas.dados]);
  const atos = useMemo(() => agrupar(lista), [lista]);

  const [atoAtivo, setAtoAtivo] = useState<string | null>(null);
  const atoSelecionado = atos.find((a) => String(a.ato) === atoAtivo) ?? atos[0] ?? null;

  // Índice global das falas do usuário, base do navegador do rodapé.
  const minhasFalas = useMemo(
    () =>
      meusIds.size > 0
        ? lista.filter((f) => f.tipo === "fala" && f.characterIds.some((id) => meusIds.has(id)))
        : [],
    [lista, meusIds],
  );

  const [indice, setIndice] = useState(-1);
  const tamanho = useSyncExternalStore(assinarTamanho, lerTamanho, noServidor);
  const [menuAberto, setMenuAberto] = useState(false);
  /*
   * Modo decoreba: as falas da pessoa ficam cobertas até ela tocar.
   *
   * Não fica guardado de propósito, ao contrário do tamanho da letra. Tamanho
   * é preferência; isto é exercício, e ninguém quer abrir o roteiro no meio do
   * ensaio e encontrar as próprias falas escondidas sem ter pedido.
   */
  const [decoreba, setDecoreba] = useState(false);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());

  function alternarDecoreba() {
    setDecoreba((ligado) => {
      // Sair e voltar recomeça o exercício, senão a segunda passada já vem
      // com tudo aberto e não serve para nada.
      setReveladas(new Set());
      return !ligado;
    });
    setMenuAberto(false);
    setBuscaAberta(false);
  }

  function revelar(id: string) {
    setReveladas((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const referencias = useRef(new Map<string, HTMLElement>());

  const registrar = useCallback((id: string, elemento: HTMLElement | null) => {
    if (elemento) referencias.current.set(id, elemento);
    else referencias.current.delete(id);
  }, []);

  /**
   * Vai para a fala do usuário no índice pedido. Se ela estiver em outro ato,
   * troca de aba antes de rolar — a rolagem espera o quadro seguinte para o
   * elemento já existir no DOM.
   */
  const irPara = useCallback(
    (novoIndice: number) => {
      if (minhasFalas.length === 0) return;
      const alvo = (novoIndice + minhasFalas.length) % minhasFalas.length;
      const fala = minhasFalas[alvo];
      setIndice(alvo);
      if (String(fala.ato) !== String(atoSelecionado?.ato)) setAtoAtivo(String(fala.ato));
      requestAnimationFrame(() => {
        referencias.current.get(fala.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [minhasFalas, atoSelecionado?.ato],
  );

  const termo = normalizar(busca);
  const combina = (fala: ScriptLine) =>
    !termo ||
    normalizar(fala.texto).includes(termo) ||
    normalizar(fala.characterNomes.join(" ")).includes(termo);

  if (!pessoa) {
    return (
      <>
        <TopoAba titulo="Roteiro" />
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
        <TopoAba titulo="Roteiro" />
        <Vazio
          titulo="Nenhuma peça em andamento"
          descricao="O roteiro aparece aqui quando a direção definir a peça atual."
        />
      </>
    );
  }

  if (!peca.roteiroPublicado) {
    return (
      <>
        <TopoAba titulo="Roteiro" subtitulo={peca.titulo} />
        <Vazio
          titulo="Roteiro ainda não publicado"
          descricao="A direção está preparando o roteiro. Assim que a primeira versão for publicada, ele aparece aqui."
        />
      </>
    );
  }

  const subtitulo = [
    peca.titulo,
    `versão ${peca.roteiroVersao}`,
    peca.roteiroPublicadoEm ? dataCurta(peca.roteiroPublicadoEm) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pb-24">
      <TopoAba
        titulo="Roteiro"
        subtitulo={subtitulo}
        acoes={
          <>
            <BotaoIcone
              rotulo="Buscar no roteiro"
              onClick={() => {
                setBuscaAberta((v) => !v);
                setMenuAberto(false);
              }}
              className={buscaAberta ? "text-brand-strong" : undefined}
            >
              <MagnifyingGlass size={20} />
            </BotaoIcone>
            <BotaoIcone
              rotulo={decoreba ? "Sair do modo decoreba" : "Modo decoreba"}
              onClick={alternarDecoreba}
              className={decoreba ? "text-brand-strong" : undefined}
            >
              {decoreba ? <Eye size={20} /> : <EyeSlash size={20} />}
            </BotaoIcone>
            <BotaoIcone
              rotulo="Tamanho da letra"
              onClick={() => {
                setMenuAberto((v) => !v);
                setBuscaAberta(false);
              }}
              className={menuAberto ? "text-brand-strong" : undefined}
            >
              <TextAa size={20} />
            </BotaoIcone>
          </>
        }
      />

      <TrocarPeca pecas={atual.dados?.pecas ?? []} escolhida={peca} />

      {buscaAberta ? (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-caption"
            />
            <Entrada
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar palavra ou personagem"
              className="pl-9"
              aria-label="Buscar no roteiro"
            />
          </div>
          {busca ? (
            <BotaoIcone rotulo="Limpar busca" onClick={() => setBusca("")}>
              <X size={18} />
            </BotaoIcone>
          ) : null}
        </div>
      ) : null}

      {decoreba ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-brand/45 bg-brand/10 px-3 py-2">
          <span className="text-[13px] leading-5 text-ink-body">
            {minhasFalas.length === 0
              ? "Você não tem falas nesta peça."
              : `${reveladas.size} de ${minhasFalas.length} ${
                  minhasFalas.length === 1 ? "fala revelada" : "falas reveladas"
                }`}
          </span>
          <div className="flex items-center gap-1">
            {reveladas.size > 0 ? (
              <Botao variante="bare" onClick={() => setReveladas(new Set())} className="h-8">
                Cobrir todas
              </Botao>
            ) : null}
            <Botao variante="ghost" onClick={alternarDecoreba} className="h-8">
              Sair
            </Botao>
          </div>
        </div>
      ) : null}

      {menuAberto ? (
        <div className="mb-3 flex items-center justify-between rounded-[8px] border border-stroke-frame bg-surface-card px-3 py-2">
          <span className="text-[13px] text-ink-caption">Tamanho da letra</span>
          <div className="flex items-center gap-1">
            <Botao
              variante="ghost"
              onClick={() => guardarTamanho(Math.max(0, tamanho - 1))}
              disabled={tamanho === 0}
              className="h-9 w-10 px-0"
            >
              A−
            </Botao>
            <Botao
              variante="ghost"
              onClick={() => guardarTamanho(Math.min(TAMANHOS.length - 1, tamanho + 1))}
              disabled={tamanho === TAMANHOS.length - 1}
              className="h-9 w-10 px-0 text-[16px]"
            >
              A+
            </Botao>
          </div>
        </div>
      ) : null}

      {falas.carregando || falas.atualizando ? (
        <Carregando texto="Carregando o roteiro" />
      ) : falas.erro ? (
        <ErroCarregamento erro={falas.erro} onTentarNovamente={falas.recarregar} />
      ) : lista.length === 0 ? (
        <Vazio
          titulo="Roteiro vazio"
          descricao="A direção publicou o roteiro, mas ainda não cadastrou as falas."
        />
      ) : (
        <>
          {atos.length > 1 ? (
            <Abas
              className="mb-4"
              abas={atos.map((a) => ({ chave: String(a.ato), rotulo: `Ato ${a.ato}` }))}
              ativa={String(atoSelecionado?.ato ?? atos[0].ato)}
              onTrocar={setAtoAtivo}
            />
          ) : null}

          {!personagem ? (
            <Cartao className="mb-4 px-4 py-3">
              <p className="text-[13px] leading-5 text-ink-caption">
                Você não está escalado nesta peça, mas acompanha o roteiro completo.
              </p>
            </Cartao>
          ) : null}

          <div
            className="roteiro-escala space-y-6"
            style={{ ["--roteiro-fonte" as string]: TAMANHOS[tamanho] }}
          >
            {(atoSelecionado ? [atoSelecionado] : []).map((ato) => (
              <section key={ato.ato}>
                {ato.titulo ? (
                  <p className="mb-3 text-[13px] leading-5 text-ink-caption">{ato.titulo}</p>
                ) : null}

                {ato.cenas.map((cena) => {
                  const minhasNaCena = personagem
                    ? cena.falas.filter(
                        (f) => f.tipo === "fala" && f.characterIds.some((id) => meusIds.has(id)),
                      ).length
                    : 0;
                  const visiveis = cena.falas.filter(combina);
                  if (termo && visiveis.length === 0) return null;

                  return (
                    <div key={cena.cena} className="mb-6">
                      {/* Barra de cena */}
                      <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-center justify-between gap-3 border-b border-stroke-frame bg-surface-base/95 px-5 py-2.5 backdrop-blur">
                        <p className="text-[13px] leading-5 font-bold text-ink-heading">
                          {rotuloCena(cena.cena, cena.titulo)}
                        </p>
                        {minhasNaCena > 0 ? (
                          <Tag tom="areia">
                            {minhasNaCena} {minhasNaCena === 1 ? "fala sua" : "falas suas"}
                          </Tag>
                        ) : null}
                      </div>

                      <ol className="flex flex-col gap-3.5">
                        {cena.falas.map((fala) => {
                          /*
                           * Fala em coro é sua também.
                           *
                           * `meusIds` cobre quem acumula papel na mesma peça, e
                           * `some` cobre a linha dita por vários — "Pai e Mãe:
                           * você não devia ter nascido!" tem de acender para o
                           * Pai e para a Mãe.
                           */
                          const minha =
                            fala.tipo === "fala" && fala.characterIds.some((id) => meusIds.has(id));
                          const escondida = termo !== "" && !combina(fala);

                          if (fala.tipo === "acao") {
                            return (
                              <li
                                key={fala.id}
                                ref={(el) => registrar(fala.id, el)}
                                className={juntar(
                                  "scroll-mt-24 text-center text-[12px] leading-[18px] text-ink-caption italic",
                                  escondida && "opacity-25",
                                )}
                              >
                                {fala.texto}
                              </li>
                            );
                          }

                          if (minha) {
                            return (
                              <li
                                key={fala.id}
                                ref={(el) => registrar(fala.id, el)}
                                className={juntar(
                                  "scroll-mt-24 rounded-r-[8px] border-l-[3px] border-brand px-3.5 py-3",
                                  escondida && "opacity-25",
                                )}
                                style={{ background: "var(--speech-bg)" }}
                              >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="eyebrow-fala text-[color:var(--color-speech-label)]">
                                    {nomesDaFala(fala.characterNomes) || "Personagem"}
                                  </span>
                                  <span className="text-[10px] leading-4 tracking-[0.12em] text-[color:var(--color-speech-label)] uppercase">
                                    Sua fala
                                  </span>
                                </div>
                                {decoreba && !reveladas.has(fala.id) ? (
                                  /*
                                   * Coberta, não apagada: a tarja ocupa o
                                   * espaço da fala. Ver o tamanho do que vem
                                   * faz parte de decorar, e um texto que some
                                   * faria a cena inteira encolher e mudar de
                                   * lugar a cada toque.
                                   */
                                  <button
                                    type="button"
                                    onClick={() => revelar(fala.id)}
                                    aria-label="Revelar esta fala"
                                    className="w-full rounded-[6px] border border-dashed border-[color:var(--color-speech-label)]/45 px-2 py-1 text-left transition-colors hover:bg-white/5"
                                  >
                                    <span
                                      aria-hidden
                                      className="block select-none rounded-[3px] bg-[color:var(--color-speech-label)]/25 font-medium text-transparent"
                                      style={{ lineHeight: 1.5 }}
                                    >
                                      {fala.texto}
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-4 text-[color:var(--color-speech-label)]">
                                      toque para ver
                                    </span>
                                  </button>
                                ) : (
                                  <p
                                    className={juntar(
                                      "font-medium text-ink-heading",
                                      decoreba && "cursor-pointer",
                                    )}
                                    style={{ lineHeight: 1.5 }}
                                    onClick={decoreba ? () => revelar(fala.id) : undefined}
                                  >
                                    {fala.texto}
                                  </p>
                                )}
                              </li>
                            );
                          }

                          return (
                            <li
                              key={fala.id}
                              ref={(el) => registrar(fala.id, el)}
                              className={juntar("scroll-mt-24", escondida && "opacity-25")}
                            >
                              <p className="eyebrow-fala mb-1 text-ink-caption">
                                {fala.tipo === "narracao"
                                  ? "Narrador"
                                  : nomesDaFala(fala.characterNomes) || "Personagem"}
                              </p>
                              <p className="text-ink-body" style={{ lineHeight: 1.53 }}>
                                {fala.texto}
                              </p>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </>
      )}

      {/* Navegador fixo entre as falas do usuário */}
      {minhasFalas.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[72px] z-20 sem-impressao">
          <div className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-3 border-t border-stroke-frame bg-surface-card px-5 py-2.5">
            <p className="text-[12px] leading-[18px] text-ink-body">
              Sua fala{" "}
              <span className="fonte-num font-bold text-ink-heading">
                {indice < 0 ? 1 : indice + 1}
              </span>{" "}
              de <span className="fonte-num">{minhasFalas.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <Botao variante="ghost" onClick={() => irPara(indice - 1)} className="gap-1.5">
                <ArrowUp size={15} />
                Anterior
              </Botao>
              <Botao onClick={() => irPara(indice + 1)} className="gap-1.5">
                Próxima
                <ArrowDown size={15} />
              </Botao>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
