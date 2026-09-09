"use client";

/**
 * Cadastro do integrante: as perguntas que a direção precisa responder antes de
 * escalar alguém. Aparece bloqueando o primeiro acesso e fica disponível para
 * edição na tela de Perfil.
 *
 * Pede data de nascimento em vez de idade: idade envelhece sozinha e é dela que
 * depende a exigência de responsável, então guardar a data mantém a informação
 * correta sem ninguém ter de atualizar nada.
 */
import { useState } from "react";
import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { completarCadastro } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { ehMenorDeIdade, idade, pluralizar } from "@/lib/format";
import { useEnvio } from "@/lib/hooks";
import {
  EXPERIENCIAS,
  MAIORIDADE,
  PECAS_FAIXAS,
  type Experiencia,
  type PecasFaixa,
  type Person,
} from "@/lib/types";
import {
  Aviso,
  Botao,
  Campo,
  Divisor,
  Entrada,
  Eyebrow,
  MarcaAlianca,
  Pastilha,
  Selecao,
  Tag,
} from "../ui";

function doPessoa(pessoa: Person) {
  return {
    nome: pessoa.nome ?? "",
    telefone: pessoa.telefone ?? "",
    nascimento: pessoa.nascimento ?? "",
    responsavelNome: pessoa.responsavelNome ?? "",
    responsavelTelefone: pessoa.responsavelTelefone ?? "",
    jaAtuou: pessoa.jaAtuou ?? null,
    experiencia: (pessoa.experiencia ?? "") as Experiencia | "",
    // Cadastros antigos guardavam um número aqui; só faixa conhecida entra.
    pecasAnteriores: (PECAS_FAIXAS as readonly string[]).includes(
      String(pessoa.pecasAnteriores ?? ""),
    )
      ? ((pessoa.pecasAnteriores ?? "") as PecasFaixa | "")
      : ("" as PecasFaixa | ""),
  };
}

export function FormularioCadastro({
  pessoa,
  primeiroAcesso = false,
  onConcluido,
  onCancelar,
}: {
  pessoa: Person;
  primeiroAcesso?: boolean;
  onConcluido: () => void;
  onCancelar?: () => void;
}) {
  const { recarregar } = useAuth();
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [form, setForm] = useState(() => doPessoa(pessoa));

  const anos = idade(form.nascimento);
  const menor = form.nascimento !== "" && ehMenorDeIdade(form.nascimento, MAIORIDADE);

  async function salvar() {
    if (!form.nome.trim() || form.nome.trim().split(/\s+/).length < 2) {
      definirErro("Escreva seu nome completo, com sobrenome.");
      return;
    }
    if (!form.telefone.trim()) {
      definirErro("Informe seu telefone.");
      return;
    }
    if (!form.nascimento) {
      definirErro("Informe sua data de nascimento.");
      return;
    }
    if (anos === null) {
      definirErro("A data de nascimento não parece válida.");
      return;
    }
    if (menor && !form.responsavelNome.trim()) {
      definirErro("Como você é menor de idade, informe o nome completo do responsável.");
      return;
    }
    if (menor && !form.responsavelTelefone.trim()) {
      definirErro("Informe o telefone do responsável.");
      return;
    }
    if (form.jaAtuou === null) {
      definirErro("Diga se você já atuou antes.");
      return;
    }
    if (form.jaAtuou && !form.experiencia) {
      definirErro("Escolha há quanto tempo você faz teatro.");
      return;
    }
    if (form.jaAtuou && !form.pecasAnteriores) {
      definirErro("Escolha em quantas peças você já atuou.");
      return;
    }

    const ok = await enviar(async () => {
      await completarCadastro(pessoa.id, {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        nascimento: form.nascimento,
        // Maior de idade não guarda responsável, mesmo que tenha digitado antes.
        responsavelNome: menor ? form.responsavelNome.trim() : "",
        responsavelTelefone: menor ? form.responsavelTelefone.trim() : "",
        jaAtuou: form.jaAtuou,
        experiencia: form.jaAtuou ? form.experiencia : "",
        pecasAnteriores: form.jaAtuou ? form.pecasAnteriores : "",
      });
      await recarregar();
    });
    if (ok) onConcluido();
  }

  return (
    <div className="space-y-3.5">
      <Campo etiqueta="Nome completo" obrigatorio>
        <Entrada
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Seu nome e sobrenome"
          autoComplete="name"
        />
      </Campo>

      <Campo etiqueta="Telefone" obrigatorio>
        <Entrada
          value={form.telefone}
          onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          placeholder="(00) 00000-0000"
          inputMode="tel"
          autoComplete="tel"
        />
      </Campo>

      <Campo
        etiqueta="Data de nascimento"
        obrigatorio
        dica={
          anos !== null
            ? `${pluralizar(anos, "ano", "anos")}${menor ? " — menor de idade" : ""}`
            : "A idade é calculada a partir daqui."
        }
      >
        <Entrada
          type="date"
          value={form.nascimento}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setForm({ ...form, nascimento: e.target.value })}
        />
      </Campo>

      {menor ? (
        <div className="rounded-[8px] border border-stroke-frame bg-surface-lower p-3.5">
          <Eyebrow>Responsável</Eyebrow>
          <p className="mt-1.5 mb-3 text-[12px] leading-[18px] text-ink-caption">
            Para participantes menores de {MAIORIDADE} anos, a direção precisa do contato de um
            responsável.
          </p>
          <div className="space-y-3.5">
            <Campo etiqueta="Nome completo do responsável" obrigatorio>
              <Entrada
                value={form.responsavelNome}
                onChange={(e) => setForm({ ...form, responsavelNome: e.target.value })}
                placeholder="Nome e sobrenome"
              />
            </Campo>
            <Campo etiqueta="Telefone do responsável" obrigatorio>
              <Entrada
                value={form.responsavelTelefone}
                onChange={(e) => setForm({ ...form, responsavelTelefone: e.target.value })}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </Campo>
          </div>
        </div>
      ) : null}

      <Divisor />

      <Campo etiqueta="Você já atuou antes?" obrigatorio>
        <div className="flex gap-2">
          <Pastilha
            marcada={form.jaAtuou === true}
            onClick={() => setForm({ ...form, jaAtuou: true })}
          >
            Já atuei
          </Pastilha>
          <Pastilha
            marcada={form.jaAtuou === false}
            onClick={() =>
              setForm({ ...form, jaAtuou: false, experiencia: "", pecasAnteriores: "" })
            }
          >
            É a primeira vez
          </Pastilha>
        </div>
      </Campo>

      {form.jaAtuou ? (
        <>
          <Campo etiqueta="Há quanto tempo você faz teatro?" obrigatorio>
            <Selecao
              value={form.experiencia}
              onChange={(e) =>
                setForm({ ...form, experiencia: e.target.value as Experiencia | "" })
              }
            >
              <option value="">Escolha</option>
              {EXPERIENCIAS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo
            etiqueta="Em quantas peças você já atuou?"
            obrigatorio
            dica="Contando as de fora do AdonaiApp. As daqui entram sozinhas no seu histórico."
          >
            <Selecao
              value={form.pecasAnteriores}
              onChange={(e) =>
                setForm({ ...form, pecasAnteriores: e.target.value as PecasFaixa | "" })
              }
            >
              <option value="">Escolha</option>
              {PECAS_FAIXAS.map((f) => (
                <option key={f} value={f}>
                  {f === "1" ? "1 peça" : f === "10+" ? "10 ou mais" : `${f} peças`}
                </option>
              ))}
            </Selecao>
          </Campo>
        </>
      ) : null}

      {erro ? <Aviso>{erro}</Aviso> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Botao
          onClick={() => void salvar()}
          disabled={enviando}
          altura={primeiroAcesso ? "form" : "acao"}
          larguraTotal={primeiroAcesso}
          className="gap-1.5"
        >
          <Check size={16} />
          {enviando ? "Salvando…" : primeiroAcesso ? "Concluir cadastro" : "Salvar"}
        </Botao>
        {onCancelar ? (
          <Botao variante="bare" onClick={onCancelar}>
            Cancelar
          </Botao>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Cadastro bloqueando o primeiro acesso da área do participante. Não tem botão
 * de "preencher depois" — são os dados que a direção usa para escalar e para
 * falar com o responsável de quem é menor —, mas também não prende ninguém:
 * sempre há como sair da conta e, para quem administra, como ir para a área da
 * direção. Fica em `z-[60]` para nenhum modal da página aparecer por cima e
 * abrir uma brecha na navegação.
 */
export function CadastroInicial({
  pessoa,
  onConcluido,
  onDepois,
}: {
  pessoa: Person;
  onConcluido: () => void;
  /** Fecha o formulário sem responder. A tarja no topo do app continua pedindo. */
  onDepois: () => void;
}) {
  const { ehAdmin, sair } = useAuth();
  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-surface-deep/85 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Complete seu cadastro"
        className="relative flex w-full max-w-lg flex-col overflow-hidden border-stroke-frame bg-surface-card sm:max-h-[92vh] sm:rounded-[16px] sm:border"
      >
        <MarcaAlianca
          tamanho={150}
          opacidade={0.05}
          className="pointer-events-none absolute -top-8 -right-10"
        />

        <div className="relative overflow-y-auto px-5 pt-8 pb-6 sm:pt-6">
          <Eyebrow className="text-brand-strong">Primeiro acesso</Eyebrow>
          <h2 className="mt-2 text-[24px] leading-7 font-bold text-ink-heading">
            Complete seu cadastro
          </h2>
          <p className="mt-2 text-[14px] leading-[21px] text-ink-body">
            São os dados que a direção usa para montar o elenco e falar com você. Leva um minuto e
            você só responde uma vez.
          </p>
          <div className="mt-3 mb-5">
            <Tag>{pessoa.email}</Tag>
          </div>

          <FormularioCadastro pessoa={pessoa} primeiroAcesso onConcluido={onConcluido} />

          <Divisor className="my-5" />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={onDepois}
              className="text-[13px] font-medium text-brand-strong hover:underline"
            >
              Deixar para depois
            </button>
            {ehAdmin ? (
              <Link
                href="/admin"
                className="text-[13px] font-medium text-brand-strong hover:underline"
              >
                Ir para a área da direção
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void sair()}
              className="text-[13px] text-ink-caption hover:text-ink-heading"
            >
              Sair da conta
            </button>
          </div>
          {ehAdmin ? (
            <p className="mt-2 text-[12px] leading-[18px] text-ink-caption">
              Seu cadastro pessoal não bloqueia a administração do teatro.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
