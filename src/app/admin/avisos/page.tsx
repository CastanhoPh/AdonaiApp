"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowClockwise, BellRinging, CheckCircle, Clock, Warning } from "@phosphor-icons/react";
import { buscarPecaAtual, criarAviso, listarAvisos, listarEnsaios } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { diaSemanaEHorario, editadoEm, hojeISO } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  AVISO_ALVOS,
  AVISO_ALVO_LABEL,
  type Aviso,
  type AvisoAlvo,
  type Play,
  type Rehearsal,
} from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin } from "@/components/shell";
import {
  AreaTexto,
  Aviso as Caixa,
  Botao,
  Campo,
  Cartao,
  Carregando,
  Divisor,
  Entrada,
  Eyebrow,
  Selecao,
  Status,
  Tag,
  TituloSecao,
} from "@/components/ui";

interface Dados {
  peca: Play | null;
  ensaios: Rehearsal[];
  avisos: Aviso[];
}

/** Textos prontos para os avisos mais comuns. */
const MODELOS = [
  { titulo: "Não esqueça do ensaio!", mensagem: "Nos vemos no horário combinado. Até logo!" },
  {
    titulo: "Ensaio alterado",
    mensagem: "Confira a nova data, o horário e o local na aba Ensaios.",
  },
  {
    titulo: "Roteiro atualizado",
    mensagem: "A direção publicou uma nova versão. Suas falas já estão destacadas no app.",
  },
  {
    titulo: "Confirme sua presença",
    mensagem: "Abra o app e diga se você vai ao próximo ensaio.",
  },
];

export default function Avisos() {
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando />
        </CorpoAdmin>
      }
    >
      <ConteudoAvisos />
    </Suspense>
  );
}

function ConteudoAvisos() {
  const ensaioDaUrl = useSearchParams().get("ensaio") ?? "";
  const { conta } = useAuth();

  const dados = useCarregar<Dados>("admin-avisos", async () => {
    const [peca, ensaios, avisos] = await Promise.all([
      buscarPecaAtual(),
      listarEnsaios(),
      listarAvisos(),
    ]);
    return { peca, ensaios, avisos };
  }, []);

  const ensaios = dados.dados?.ensaios ?? [];
  const peca = dados.dados?.peca ?? null;
  const avisos = dados.dados?.avisos ?? [];
  const hoje = hojeISO();
  // Avisar sobre ensaio que já passou não faz sentido.
  const futuros = ensaios.filter((e) => e.data >= hoje && e.status !== "cancelado");

  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [alvo, setAlvo] = useState<AvisoAlvo>(ensaioDaUrl ? "convocados" : "elenco");
  const [rehearsalId, setRehearsalId] = useState(ensaioDaUrl);
  const [enfileirado, setEnfileirado] = useState(false);

  const ensaioEscolhido = futuros.find((e) => e.id === rehearsalId) ?? futuros[0] ?? null;

  /**
   * Tenta de novo um aviso que não saiu.
   *
   * Cria um aviso novo em vez de mexer no antigo: a entrega é disparada pela
   * *criação* do documento, então reaproveitar o registro parado não acionaria
   * nada. E o histórico fica honesto — cada tentativa é uma linha, com o
   * resultado dela.
   *
   * Existe porque aviso pode ficar parado: se a função de entrega estiver fora
   * do ar no instante em que ele é criado, não há nova chance automática. Sem
   * este botão, a única saída era digitar tudo outra vez.
   */
  async function reenviar(a: Aviso) {
    await enviar(async () => {
      await criarAviso({
        titulo: a.titulo,
        mensagem: a.mensagem,
        alvo: a.alvo,
        rehearsalId: a.rehearsalId ?? "",
        playId: a.playId ?? "",
        criadoPor: conta?.nome ?? conta?.email ?? "",
      });
      await dados.recarregar();
    });
  }

  async function disparar() {
    setEnfileirado(false);
    if (!titulo.trim()) {
      definirErro("Escreva o título do aviso — é o que aparece em negrito na notificação.");
      return;
    }
    if (!mensagem.trim()) {
      definirErro("Escreva a mensagem.");
      return;
    }
    if (alvo === "convocados" && !ensaioEscolhido) {
      definirErro("Escolha o ensaio dos convocados.");
      return;
    }
    if (alvo === "elenco" && !peca) {
      definirErro("Não há peça atual definida para avisar o elenco.");
      return;
    }

    const ok = await enviar(async () => {
      await criarAviso({
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        alvo,
        rehearsalId: alvo === "convocados" ? (ensaioEscolhido?.id ?? "") : "",
        playId:
          alvo === "convocados"
            ? (ensaioEscolhido?.playId ?? "")
            : alvo === "elenco"
              ? (peca?.id ?? "")
              : "",
        criadoPor: conta?.email ?? "",
      });
      await dados.recarregar();
    });

    if (ok) {
      setTitulo("");
      setMensagem("");
      setEnfileirado(true);
    }
  }

  return (
    <>
      <TopoAdmin
        titulo="Avisos"
        subtitulo="Mande uma notificação para quem autorizou os avisos no aplicativo."
      />

      <CorpoAdmin>
        {dados.carregando ? (
          <Carregando />
        ) : dados.erro ? (
          <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
        ) : (
          <div className="grid gap-4 min-[900px]:grid-cols-[1.1fr_1fr]">
            {/* Composição */}
            <Cartao className="px-4 py-4">
              <TituloSecao titulo="Novo aviso" />

              <div className="mb-4">
                <Eyebrow>Modelos</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MODELOS.map((m) => (
                    <button
                      key={m.titulo}
                      type="button"
                      onClick={() => {
                        setTitulo(m.titulo);
                        setMensagem(m.mensagem);
                        definirErro(null);
                      }}
                      className="rounded-full border border-stroke-frame px-3 py-1.5 text-[12px] font-medium text-ink-caption transition-colors hover:border-brand hover:text-brand-strong"
                    >
                      {m.titulo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3.5">
                <Campo etiqueta="Título" obrigatorio dica="Aparece em negrito na notificação.">
                  <Entrada
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Não esqueça do ensaio!"
                    maxLength={60}
                  />
                </Campo>

                <Campo etiqueta="Mensagem" obrigatorio>
                  <AreaTexto
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Nos vemos no horário combinado. Até logo!"
                    maxLength={180}
                    className="min-h-[80px]"
                  />
                </Campo>

                <Campo etiqueta="Para quem">
                  <Selecao value={alvo} onChange={(e) => setAlvo(e.target.value as AvisoAlvo)}>
                    {AVISO_ALVOS.map((a) => (
                      <option key={a} value={a}>
                        {AVISO_ALVO_LABEL[a]}
                      </option>
                    ))}
                  </Selecao>
                </Campo>

                {alvo === "convocados" ? (
                  <Campo etiqueta="Ensaio" obrigatorio>
                    {futuros.length === 0 ? (
                      <p className="text-[13px] leading-5 text-ink-caption">
                        Nenhum ensaio futuro cadastrado. Marque o ensaio antes de avisar.
                      </p>
                    ) : (
                      <Selecao
                        value={ensaioEscolhido?.id ?? ""}
                        onChange={(e) => setRehearsalId(e.target.value)}
                      >
                        {futuros.map((e) => (
                          <option key={e.id} value={e.id}>
                            {diaSemanaEHorario(e.data, e.horaInicio, e.horaFim)}
                            {e.playTitulo ? ` · ${e.playTitulo}` : ""}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                ) : null}

                {alvo === "elenco" ? (
                  <p className="text-[12px] leading-[18px] text-ink-caption">
                    {peca
                      ? `Vai para quem está escalado em “${peca.titulo}”.`
                      : "Nenhuma peça atual definida."}
                  </p>
                ) : null}

                {alvo === "todos" ? (
                  <p className="text-[12px] leading-[18px] text-ink-caption">
                    Vai para todos os integrantes com cadastro ativo, escalados ou não.
                  </p>
                ) : null}

                {erro ? <Caixa>{erro}</Caixa> : null}
                {enfileirado ? (
                  <Caixa tom="positivo">
                    Aviso enviado. A entrega leva alguns segundos; atualize a lista ao lado para
                    ver em quantos aparelhos chegou.
                  </Caixa>
                ) : null}

                <Botao onClick={() => void disparar()} disabled={enviando} className="gap-1.5">
                  <BellRinging size={16} />
                  {enviando ? "Enviando…" : "Enviar aviso"}
                </Botao>
              </div>
            </Cartao>

            {/* Histórico e como a entrega funciona */}
            <div className="space-y-4">
              <Cartao className="bg-surface-raised px-4 py-4">
                <TituloSecao titulo="Como a entrega funciona" />
                <p className="text-[13px] leading-5 text-ink-body">
                  Mandar notificação exige credencial de servidor, que não pode ficar no navegador.
                  Você compõe aqui e uma função no servidor entrega em poucos segundos, sem mais
                  nenhum passo manual.
                </p>
                <p className="mt-2.5 text-[13px] leading-5 text-ink-body">
                  Só recebe quem autorizou os avisos no próprio Perfil, e apenas nos aparelhos onde
                  autorizou. Quem não autorizou não entra na conta de entregues.
                </p>
                <p className="mt-2.5 text-[12px] leading-[18px] text-ink-caption">
                  Na véspera de cada ensaio, às 7h30, o lembrete “Não esqueça do ensaio!” sai
                  sozinho para os convocados e aparece na lista ao lado como qualquer outro aviso.
                </p>
              </Cartao>

              <Cartao className="px-4 py-4">
                <TituloSecao
                  titulo="Últimos avisos"
                  acao={
                    <Botao variante="bare" onClick={() => void dados.recarregar()}>
                      Atualizar
                    </Botao>
                  }
                />
                {avisos.length === 0 ? (
                  <p className="text-[13px] leading-5 text-ink-caption">
                    Nenhum aviso disparado ainda.
                  </p>
                ) : (
                  <ul>
                    {avisos.map((a) => (
                      <li key={a.id} className="border-b border-stroke-list py-3 last:border-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[14px] leading-[21px] font-medium text-ink-heading">
                            {a.titulo}
                          </p>
                          {a.status === "enviado" ? (
                            <Status tom="positivo">
                              {a.entregues} {a.entregues === 1 ? "aparelho" : "aparelhos"}
                            </Status>
                          ) : a.status === "erro" ? (
                            <Status tom="negativo">Falhou</Status>
                          ) : (
                            <Status tom="aviso">Na fila</Status>
                          )}
                        </div>
                        <p className="mt-0.5 text-[13px] leading-5 text-ink-body">{a.mensagem}</p>
                        <p className="mt-1 text-[11px] leading-4 text-ink-caption">
                          {AVISO_ALVO_LABEL[a.alvo]} · {editadoEm(a.criadoEm)}
                          {a.criadoPor ? ` · ${a.criadoPor}` : ""}
                        </p>
                        {a.detalhe ? (
                          <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-ink-caption">
                            {a.status === "erro" ? (
                              <Warning size={13} className="mt-px shrink-0" />
                            ) : a.status === "enviado" ? (
                              <CheckCircle size={13} className="mt-px shrink-0" />
                            ) : (
                              <Clock size={13} className="mt-px shrink-0" />
                            )}
                            {a.detalhe}
                          </p>
                        ) : null}
                        {a.status !== "enviado" ? (
                          <div className="mt-1.5">
                            <Botao
                              variante="bare"
                              onClick={() => void reenviar(a)}
                              disabled={enviando}
                              className="gap-1.5"
                            >
                              <ArrowClockwise size={14} />
                              Tentar de novo
                            </Botao>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>

              <Cartao className="px-4 py-4">
                <Eyebrow>Quem recebe</Eyebrow>
                <Divisor className="my-2.5" />
                <p className="text-[13px] leading-5 text-ink-caption">
                  Só chega para quem autorizou os avisos no aplicativo, na tela de Perfil. Quem não
                  autorizou continua vendo tudo pela aba Ensaios.
                </p>
                <div className="mt-2.5">
                  <Tag>Um aparelho por autorização</Tag>
                </div>
              </Cartao>
            </div>
          </div>
        )}
      </CorpoAdmin>
    </>
  );
}
