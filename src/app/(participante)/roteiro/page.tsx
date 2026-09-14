"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MagnifyingGlass, TextAa, X } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { listarFalas } from "@/lib/db";
import { dataCurta, nomesDaFala, normalizar, rotuloCena } from "@/lib/format";
import { useCarregar } from "@/lib/hooks";
import { useAtual } from "@/lib/uso-atual";
import type { ScriptLine } from "@/lib/types";
import { ErroCarregamento, TopoAba } from "@/components/shell";
import { SemVinculo } from "@/components/comum/sem-vinculo";
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
  const [tamanho, setTamanho] = useState(1);
  const [menuAberto, setMenuAberto] = useState(false);
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

      {menuAberto ? (
        <div className="mb-3 flex items-center justify-between rounded-[8px] border border-stroke-frame bg-surface-card px-3 py-2">
          <span className="text-[13px] text-ink-caption">Tamanho da letra</span>
          <div className="flex items-center gap-1">
            <Botao
              variante="ghost"
              onClick={() => setTamanho((t) => Math.max(0, t - 1))}
              disabled={tamanho === 0}
              className="h-9 w-10 px-0"
            >
              A−
            </Botao>
            <Botao
              variante="ghost"
              onClick={() => setTamanho((t) => Math.min(TAMANHOS.length - 1, t + 1))}
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
                                <p
                                  className="font-medium text-ink-heading"
                                  style={{ lineHeight: 1.5 }}
                                >
                                  {fala.texto}
                                </p>
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
