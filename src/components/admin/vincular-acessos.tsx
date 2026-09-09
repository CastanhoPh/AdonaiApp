"use client";

/**
 * Liga contas de acesso às pessoas do cadastro.
 *
 * O app não faz mais esse vínculo sozinho. Antes, conta nova era ligada à
 * pessoa cadastrada com o mesmo e-mail — conveniente, mas decidia quem é quem
 * a partir de um campo que a própria pessoa escolhe ao se cadastrar. Histórico
 * de alguém não deve ser atribuído por coincidência de texto.
 *
 * Enquanto não há vínculo, a pessoa entra no app e vê a tela de "sem vínculo":
 * nada de personagem, roteiro, ensaio ou histórico. Por isso o bloco fica no
 * topo de Pessoas quando há pendência, e desaparece quando não há — é fila de
 * trabalho, não seção permanente.
 */
import { useState } from "react";
import { LinkSimple, Warning } from "@phosphor-icons/react";
import { listarContas, listarPessoas, vincularContaAPessoa } from "@/lib/db";
import { useCarregar, useEnvio } from "@/lib/hooks";
import type { Person, UserAccount } from "@/lib/types";
import { Aviso, Botao, Cartao, Esqueleto, Selecao, Tag, TituloSecao } from "@/components/ui";

interface Dados {
  contas: UserAccount[];
  pessoas: Person[];
}

export function VincularAcessos() {
  const dados = useCarregar<Dados>("admin-vinculos", async () => {
    const [contas, pessoas] = await Promise.all([listarContas(), listarPessoas()]);
    return { contas, pessoas };
  }, []);
  const { enviando, erro, enviar } = useEnvio();
  /** Escolha em aberto por conta, antes de confirmar. */
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const contas = dados.dados?.contas ?? [];
  const pessoas = dados.dados?.pessoas ?? [];
  const semVinculo = contas.filter((c) => !c.personId);

  // Pessoa já ligada a outra conta não deve aparecer como opção livre.
  const ocupadas = new Set(contas.map((c) => c.personId).filter(Boolean) as string[]);

  async function ligar(conta: UserAccount) {
    const personId = escolhas[conta.uid];
    if (!personId) return;
    await enviar(async () => {
      await vincularContaAPessoa(conta.uid, personId);
      await dados.recarregar();
    });
    setEscolhas((atual) => {
      const proximo = { ...atual };
      delete proximo[conta.uid];
      return proximo;
    });
  }

  if (dados.carregando) return <Esqueleto className="mb-4 h-24 rounded-[16px]" />;

  /*
   * Erro aparece. A primeira versão escondia o bloco em silêncio para não
   * atrapalhar a tela de Pessoas — e o efeito foi não haver como distinguir
   * "nada pendente" de "não consegui ler as contas". Vínculo pendente que
   * desaparece sem aviso é pior que um aviso de erro.
   */
  if (dados.erro) {
    return (
      <div className="mb-4">
        <Aviso>Não foi possível verificar os acessos: {dados.erro}</Aviso>
      </div>
    );
  }
  if (semVinculo.length === 0) return null;

  return (
    <Cartao className="mb-4 border-state-warning/40 bg-state-warning/8 px-4 py-4">
      <TituloSecao
        titulo={`${semVinculo.length} ${
          semVinculo.length === 1 ? "acesso sem vínculo" : "acessos sem vínculo"
        }`}
        descricao="Estas contas entraram no app mas ainda não estão ligadas a ninguém do cadastro. Sem o vínculo, a pessoa não vê personagem, roteiro, ensaio nem histórico."
      />

      <ul className="space-y-3">
        {semVinculo.map((conta) => (
          <li
            key={conta.uid}
            className="flex flex-wrap items-end gap-3 border-b border-stroke-list pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-[200px] flex-1">
              <p className="flex items-center gap-1.5 text-[14px] leading-5 font-medium text-ink-heading">
                <Warning size={14} className="shrink-0 text-state-warning" />
                {conta.nome || "(sem nome)"}
              </p>
              <p className="truncate text-[12px] leading-[18px] text-ink-caption">
                {conta.email}
                {conta.role === "admin" ? " · direção" : ""}
              </p>
            </div>

            <div className="w-[260px] max-sm:w-full">
              <Selecao
                value={escolhas[conta.uid] ?? ""}
                onChange={(e) =>
                  setEscolhas({ ...escolhas, [conta.uid]: e.target.value })
                }
                aria-label={`Pessoa para ${conta.email}`}
              >
                <option value="">Escolha a pessoa…</option>
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                    {ocupadas.has(pessoa.id) ? " (já tem acesso)" : ""}
                  </option>
                ))}
              </Selecao>
            </div>

            <Botao
              onClick={() => void ligar(conta)}
              disabled={enviando || !escolhas[conta.uid]}
              className="gap-1.5"
            >
              <LinkSimple size={15} />
              Vincular
            </Botao>
          </li>
        ))}
      </ul>

      {erro ? (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      <p className="mt-3 text-[12px] leading-[18px] text-ink-caption">
        A pessoa passa a ver os próprios dados no acesso seguinte dela.
      </p>
    </Cartao>
  );
}

/** Mostra, na ficha da pessoa, se existe acesso ligado a ela. */
export function AcessoDaPessoa({ personId }: { personId: string }) {
  const contas = useCarregar<UserAccount[]>("contas-para-ficha", () => listarContas(), []);
  if (contas.carregando || contas.erro) return null;

  const ligada = (contas.dados ?? []).find((c) => c.personId === personId);
  return ligada ? (
    <Tag tom="positivo">Acesso: {ligada.email}</Tag>
  ) : (
    <Tag tom="aviso">Sem acesso vinculado</Tag>
  );
}
