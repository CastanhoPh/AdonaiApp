"use client";

/**
 * Quem dirigiu a peça.
 *
 * Fica junto do elenco porque é a mesma tarefa — atribuir pessoas à peça — mas
 * separado dele nos dados: dirigir é função de produção, não papel de atuação.
 * Se direção fosse um tipo de papel, quem só dirigiu apareceria no histórico
 * como se tivesse atuado, e quem dirigiu e atuou perderia um dos dois.
 *
 * A mesma pessoa pode estar aqui e no elenco. Acontece com frequência: em
 * "Jardim Secreto", quem apresentou também dirigiu.
 */
import { useState } from "react";
import { MegaphoneSimple, X } from "@phosphor-icons/react";
import { definirDirecao } from "@/lib/db";
import { useEnvio } from "@/lib/hooks";
import { nomeCurto } from "@/lib/format";
import type { Person, Play } from "@/lib/types";
import { Aviso, Botao, Cartao, Selecao, Tag, TituloSecao } from "@/components/ui";

type Funcao = "diretores" | "vicesDiretores";

const ROTULO: Record<Funcao, { titulo: string; vazio: string }> = {
  diretores: { titulo: "Direção", vazio: "Ninguém marcado como diretor." },
  vicesDiretores: { titulo: "Vice-direção", vazio: "Ninguém marcado como vice-diretor." },
};

export function DirecaoDaPeca({
  peca,
  pessoas,
  onAtualizar,
}: {
  peca: Play;
  pessoas: Person[];
  onAtualizar: () => Promise<void>;
}) {
  const { enviando, erro, enviar } = useEnvio();
  const [aberto, setAberto] = useState(false);

  const atual: Record<Funcao, string[]> = {
    diretores: peca.diretores ?? [],
    vicesDiretores: peca.vicesDiretores ?? [],
  };
  const total = atual.diretores.length + atual.vicesDiretores.length;
  const porId = new Map(pessoas.map((p) => [p.id, p]));

  async function gravar(proximo: Record<Funcao, string[]>) {
    await enviar(async () => {
      await definirDirecao(peca.id, proximo);
      await onAtualizar();
    });
  }

  /*
   * Trocar de função move, não duplica: alguém marcado nas duas listas
   * apareceria duas vezes na peça, e "diretor e vice ao mesmo tempo" não
   * significa nada.
   */
  function adicionar(funcao: Funcao, personId: string) {
    if (!personId) return;
    void gravar({
      diretores: (funcao === "diretores"
        ? [...atual.diretores, personId]
        : atual.diretores.filter((x) => x !== personId)
      ).filter((x, i, a) => a.indexOf(x) === i),
      vicesDiretores: (funcao === "vicesDiretores"
        ? [...atual.vicesDiretores, personId]
        : atual.vicesDiretores.filter((x) => x !== personId)
      ).filter((x, i, a) => a.indexOf(x) === i),
    });
  }

  function remover(funcao: Funcao, personId: string) {
    void gravar({ ...atual, [funcao]: atual[funcao].filter((x) => x !== personId) });
  }

  return (
    <Cartao className="mb-4 px-4 py-4">
      <TituloSecao
        titulo="Direção da peça"
        descricao={
          total === 0
            ? "Quem dirigiu e quem foi vice. Não conta como atuação no histórico."
            : undefined
        }
        acao={
          <Botao variante="bare" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Fechar" : total === 0 ? "Definir" : "Editar"}
          </Botao>
        }
      />

      {/* Fechado: só os nomes, para não ocupar a tela de escalação. */}
      {!aberto ? (
        total === 0 ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <MegaphoneSimple size={15} className="shrink-0 text-brand" />
            {(["diretores", "vicesDiretores"] as Funcao[]).flatMap((f) =>
              atual[f].map((id) => (
                <Tag key={`${f}-${id}`} tom={f === "diretores" ? "areia" : "info"}>
                  {nomeCurto(porId.get(id)?.nome ?? "—")}
                  {f === "vicesDiretores" ? " · vice" : ""}
                </Tag>
              )),
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {(["diretores", "vicesDiretores"] as Funcao[]).map((funcao) => (
            <div key={funcao}>
              <p className="mb-1.5 text-[12px] leading-[18px] text-ink-caption">
                {ROTULO[funcao].titulo}
              </p>

              {atual[funcao].length === 0 ? (
                <p className="mb-2 text-[13px] leading-5 text-ink-caption">
                  {ROTULO[funcao].vazio}
                </p>
              ) : (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {atual[funcao].map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => remover(funcao, id)}
                        disabled={enviando}
                        className="flex items-center gap-1.5 rounded-full border border-stroke-frame px-3 py-1 text-[13px] text-ink-heading transition-colors hover:bg-surface-hover"
                        aria-label={`Remover ${porId.get(id)?.nome ?? ""} da ${ROTULO[funcao].titulo}`}
                      >
                        {porId.get(id)?.nome ?? "—"}
                        <X size={13} className="text-ink-caption" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="w-[280px] max-sm:w-full">
                <Selecao
                  value=""
                  onChange={(e) => adicionar(funcao, e.target.value)}
                  disabled={enviando}
                  aria-label={`Adicionar a ${ROTULO[funcao].titulo}`}
                >
                  <option value="">Adicionar pessoa…</option>
                  {pessoas
                    .filter((p) => !atual[funcao].includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </Selecao>
              </div>
            </div>
          ))}
        </div>
      )}

      {erro ? (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}
    </Cartao>
  );
}
