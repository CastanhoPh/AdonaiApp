"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, BellRinging, CaretRight } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { atualizarPessoa, listarParticipacoes } from "@/lib/db";
import { ano, ehMenorDeIdade, idade, nomeCurto, pluralizar } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  LADO_MINIATURA,
  caminhoDaFotoDoAtor,
  caminhoDaMiniaturaDoAtor,
} from "@/lib/armazenamento";
import { reabrirGuia } from "@/lib/instalacao";
import { useAtual } from "@/lib/uso-atual";
import { MAIORIDADE, ROLE_TYPE_LABEL, type Participation } from "@/lib/types";
import { TopoAba } from "@/components/shell";
import { FormularioCadastro } from "@/components/acesso/cadastro-pessoa";
import { EnviarFoto } from "@/components/comum/enviar-foto";
import { ControleNotificacoes } from "@/components/comum/notificacoes";
import { SemVinculo } from "@/components/comum/sem-vinculo";
import {
  Avatar,
  Aviso,
  Botao,
  Cartao,
  Divisor,
  Eyebrow,
  Status,
  Tag,
} from "@/components/ui";

export default function Perfil() {
  const { conta, pessoa, ehAdmin, sair, recarregar } = useAuth();
  const atual = useAtual();
  const personagens = atual.dados?.personagens ?? [];
  // O card mostra um; com mais de um, o primeiro e a contagem do resto.
  const principal = personagens[0] ?? null;

  const participacoes = useCarregar<Participation[]>(
    "perfil-participacoes",
    async () => (pessoa ? listarParticipacoes(pessoa.id) : []),
    [pessoa?.id],
  );
  const { enviando, erro, enviar } = useEnvio();
  /*
   * Cadastro incompleto abre já no formulário: é para cá que aponta a tarja
   * "Completar" do topo do app, e cair numa tela de leitura obrigaria a
   * procurar o botão "Editar meus dados".
   */
  const [editando, setEditando] = useState<"nada" | "dados" | "foto">(
    pessoa && !pessoa.cadastroCompletoEm ? "dados" : "nada",
  );
  const [salvo, setSalvo] = useState(false);

  function abrirFoto() {
    setSalvo(false);
    setEditando("foto");
  }

  /** Grava a URL que o Storage devolveu e recarrega a sessão para o avatar trocar. */
  async function guardarFoto(url: string, miniUrl = "") {
    await enviar(async () => {
      if (!pessoa) return;
      // As duas juntas: a grande para a ficha, a pequena para os círculos.
      await atualizarPessoa(pessoa.id, { fotoUrl: url, fotoMiniUrl: miniUrl });
      await recarregar();
    });
    setSalvo(true);
  }

  function reverTutorial() {
    if (!conta) return;
    reabrirGuia("tutorial", conta.uid);
    reabrirGuia("tour", conta.uid);
    // Recarrega para os guias remontarem lendo o armazenamento já limpo.
    window.location.reload();
  }

  if (!pessoa) {
    return (
      <div>
        <TopoAba titulo="Perfil" />
        <SemVinculo />
        <Cartao className="mt-4 px-4 py-3.5">
          <p className="text-[13px] leading-5 text-ink-caption">Conta</p>
          <p className="text-[14px] text-ink-heading">{conta?.email}</p>
          <div className="mt-3">
            <Botao variante="ghost" onClick={() => void sair()}>
              Sair da conta
            </Botao>
          </div>
        </Cartao>
      </div>
    );
  }

  const lista = participacoes.dados ?? [];
  const desde = lista.length > 0 ? ano(lista[lista.length - 1].periodo) : null;

  return (
    <div>
      <TopoAba titulo="Perfil" />

      <Cartao className="mb-4 px-4 py-4">
        <div className="flex items-start gap-3.5">
          <Avatar nome={pessoa.nome} url={pessoa.fotoUrl} mini={pessoa.fotoMiniUrl} tamanho={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[20px] leading-6 font-bold text-ink-heading">
              {nomeCurto(pessoa.nome)}
            </p>
            <p className="mt-0.5 truncate text-[13px] leading-5 text-ink-caption">
              {pessoa.email}
              {pessoa.contato?.telefone ? ` · ${pessoa.contato?.telefone}` : ""}
              {desde ? ` · desde ${desde}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Status tom={pessoa.ativo ? "positivo" : "neutro"}>
                {pessoa.ativo ? "Ativo no grupo" : "Inativo"}
              </Status>
              {ehAdmin ? <Tag tom="info">Direção</Tag> : null}
            </div>
          </div>
        </div>

        {salvo ? (
          <div className="mt-4">
            <Aviso tom="positivo">Dados atualizados.</Aviso>
          </div>
        ) : null}

        {editando === "dados" ? (
          <div className="mt-4 border-t border-stroke-frame pt-4">
            <FormularioCadastro
              pessoa={pessoa}
              onConcluido={() => {
                setEditando("nada");
                setSalvo(true);
              }}
              onCancelar={() => setEditando("nada")}
            />
          </div>
        ) : editando === "foto" ? (
          <div className="mt-4 space-y-3 border-t border-stroke-frame pt-4">
            <EnviarFoto
              caminho={caminhoDaFotoDoAtor(pessoa.id, pessoa.nome)}
              miniatura={{
                caminho: caminhoDaMiniaturaDoAtor(pessoa.id, pessoa.nome),
                lado: LADO_MINIATURA,
              }}
              // A pasta guarda só a foto desta pessoa: limpar antes evita que
              // uma troca de nome deixe o arquivo antigo para trás.
              pasta={`atores/${pessoa.id}/`}
              atual={pessoa.fotoUrl}
              rotulo="Escolher da galeria"
              onEnviada={guardarFoto}
              onRemovida={() => guardarFoto("", "")}
              desabilitado={enviando}
            />
            {erro ? <Aviso>{erro}</Aviso> : null}
            <Botao type="button" variante="bare" onClick={() => setEditando("nada")}>
              Concluir
            </Botao>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="ghost" onClick={() => setEditando("dados")}>
              Editar meus dados
            </Botao>
            <Botao variante="bare" onClick={abrirFoto}>
              Alterar foto
            </Botao>
          </div>
        )}
      </Cartao>

      {/* Respostas do cadastro */}
      {editando === "nada" ? (
        <Cartao className="mb-4 px-4 py-4">
          <Eyebrow>Meu cadastro</Eyebrow>
          <dl className="mt-2">
            <Dado
              rotulo="Idade"
              valor={
                pessoa.contato?.nascimento && idade(pessoa.contato?.nascimento) !== null
                  ? pluralizar(idade(pessoa.contato?.nascimento) as number, "ano", "anos")
                  : "não informada"
              }
            />
            {pessoa.contato?.nascimento && ehMenorDeIdade(pessoa.contato?.nascimento, MAIORIDADE) ? (
              <>
                <Dado rotulo="Responsável" valor={pessoa.contato?.responsavelNome || "não informado"} />
                <Dado
                  rotulo="Telefone dele"
                  valor={pessoa.contato?.responsavelTelefone || "não informado"}
                />
              </>
            ) : null}
            <Dado
              rotulo="Experiência"
              valor={
                pessoa.jaAtuou === true
                  ? pessoa.experiencia || "não informada"
                  : pessoa.jaAtuou === false
                    ? "primeira vez no teatro"
                    : "não informada"
              }
            />
            {pessoa.jaAtuou && pessoa.pecasAnteriores ? (
              <Dado rotulo="Peças antes daqui" valor={pessoa.pecasAnteriores} ultima />
            ) : null}
          </dl>
        </Cartao>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Cartao className="px-4 py-3.5">
          <Eyebrow>Peças</Eyebrow>
          <p className="fonte-num mt-1 text-[24px] leading-7 font-bold text-ink-heading">
            {participacoes.carregando ? "…" : lista.length}
          </p>
        </Cartao>
        <Cartao className="px-4 py-3.5">
          <Eyebrow>Personagem</Eyebrow>
          <p className="mt-1 truncate text-[15px] leading-[22px] font-bold text-ink-heading">
            {atual.carregando ? "…" : (principal?.nome ?? "Nenhum")}
          </p>
          {principal ? (
            <p className="text-[12px] leading-[18px] text-ink-caption">
              {ROLE_TYPE_LABEL[principal.tipoPapel]}
              {personagens.length > 1 ? ` · +${personagens.length - 1}` : ""}
            </p>
          ) : null}
        </Cartao>
      </div>

      <Cartao className="mb-4 px-4 py-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-brand">
            <BellRinging size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] leading-6 font-bold text-ink-heading">Avisos de ensaio</h2>
            <p className="text-[13px] leading-5 text-ink-caption">
              Para a direção poder te avisar quando um ensaio for marcado, alterado ou cancelado.
            </p>
          </div>
        </div>
        <ControleNotificacoes larguraTotal />
      </Cartao>

      <Cartao className="overflow-hidden">
        <Link
          href="/historico"
          className="flex items-center justify-between gap-2 px-4 py-3.5 text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
        >
          Histórico de peças
          <CaretRight size={15} className="text-ink-caption" />
        </Link>
        {ehAdmin ? (
          <>
            <Divisor />
            <Link
              href="/admin"
              className="flex items-center justify-between gap-2 px-4 py-3.5 text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
            >
              Área da direção
              <CaretRight size={15} className="text-ink-caption" />
            </Link>
          </>
        ) : null}
        <Divisor />
        <button
          type="button"
          onClick={reverTutorial}
          className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
        >
          Rever o tutorial
          <ArrowCounterClockwise size={15} className="text-ink-caption" />
        </button>
        <Divisor />
        <button
          type="button"
          onClick={() => void sair()}
          className="w-full px-4 py-3.5 text-left text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
        >
          Sair da conta
        </button>
      </Cartao>
    </div>
  );
}

/** Linha rótulo/valor do cadastro, separada por stroke-list. */
function Dado({
  rotulo,
  valor,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  ultima?: boolean;
}) {
  return (
    <div
      className={
        ultima
          ? "flex items-baseline justify-between gap-3 py-2"
          : "flex items-baseline justify-between gap-3 border-b border-stroke-list py-2"
      }
    >
      <dt className="text-[13px] leading-5 text-ink-caption">{rotulo}</dt>
      <dd className="text-[14px] leading-[21px] text-ink-heading">{valor}</dd>
    </div>
  );
}
