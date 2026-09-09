"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  atualizarPessoa,
  buscarObservacoes,
  buscarPecaAtual,
  buscarPersonagemDaPessoa,
  buscarCaracteristicasAtribuidas,
  buscarPessoa,
  listarCaracteristicas,
  listarParticipacoes,
  salvarObservacoes,
} from "@/lib/db";
import { ano, dataLonga, ehMenorDeIdade, idade, nomeCurto, pluralizar } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import {
  MAIORIDADE,
  ROLE_TYPE_LABEL,
  type Character,
  type Participation,
  type Person,
  type Play,
  type Trait,
} from "@/lib/types";
import { caminhoDaFotoDoAtor } from "@/lib/armazenamento";
import { CorpoAdmin, ErroCarregamento, TopoAdmin, VoltarPara } from "@/components/shell";
import { EnviarFoto } from "@/components/comum/enviar-foto";
import { LinhaParticipacao } from "@/components/comum/participacao-cartao";
import {
  Abas,
  AreaTexto,
  Avatar,
  Aviso,
  Botao,
  Caixa,
  Campo,
  Cartao,
  Carregando,
  Divisor,
  Entrada,
  Eyebrow,
  SeloDirecao,
  Status,
  Tag,
  TituloSecao,
  Vazio,
} from "@/components/ui";

type Aba = "geral" | "historico" | "observacoes";

interface Dados {
  pessoa: Person | null;
  peca: Play | null;
  personagem: Character | null;
  participacoes: Participation[];
  caracteristicas: Trait[];
  observacoes: string;
}

export default function PerfilAdministrativo() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense fallback={<CorpoAdmin><Carregando /></CorpoAdmin>}>
      <ConteudoPerfil />
    </Suspense>
  );
}

function ConteudoPerfil() {
  const id = useSearchParams().get("id") ?? "";

  const dados = useCarregar<Dados>("admin-pessoa", async () => {
    if (!id) {
      return {
        pessoa: null,
        peca: null,
        personagem: null,
        participacoes: [],
        caracteristicas: [],
        observacoes: "",
      };
    }
    const [pessoa, peca, participacoes, caracteristicas, notas, atribuidas] = await Promise.all([
      buscarPessoa(id),
      buscarPecaAtual(),
      listarParticipacoes(id),
      listarCaracteristicas(),
      buscarObservacoes(id),
      buscarCaracteristicasAtribuidas(),
    ]);
    const personagem = peca ? await buscarPersonagemDaPessoa(peca.id, id) : null;
    return {
      // Mesclado aqui: o documento da pessoa não guarda mais a avaliação.
      pessoa: pessoa ? { ...pessoa, caracteristicas: atribuidas.pessoas[id] ?? [] } : null,
      peca,
      personagem,
      participacoes,
      caracteristicas,
      observacoes: notas?.observacoes ?? "",
    };
  }, [id]);

  const { enviando, erro, enviar } = useEnvio();
  const [aba, setAba] = useState<Aba>("geral");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    fotoUrl: "",
    ativo: true,
    caracteristicas: [] as string[],
  });
  // `null` significa "nada digitado ainda": mostra o valor salvo.
  const [notas, setNotas] = useState<string | null>(null);
  const [notasSalvas, setNotasSalvas] = useState(false);

  const pessoa = dados.dados?.pessoa ?? null;
  const traits = dados.dados?.caracteristicas ?? [];
  const participacoes = dados.dados?.participacoes ?? [];
  const personagem = dados.dados?.personagem ?? null;
  const observacoesAtuais = dados.dados?.observacoes ?? "";

  function abrirEdicao() {
    if (!pessoa) return;
    setForm({
      nome: pessoa.nome,
      email: pessoa.email,
      telefone: pessoa.telefone ?? "",
      fotoUrl: pessoa.fotoUrl ?? "",
      ativo: pessoa.ativo,
      caracteristicas: pessoa.caracteristicas ?? [],
    });
    setEditando(true);
  }

  /** Foto vai direto para o cadastro; o resto do formulário espera o Salvar. */
  async function salvarFoto(url: string) {
    setForm({ ...form, fotoUrl: url });
    await enviar(async () => {
      await atualizarPessoa(id, { fotoUrl: url });
      await dados.recarregar();
    });
  }

  async function salvar() {
    const ok = await enviar(async () => {
      await atualizarPessoa(id, {
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        fotoUrl: form.fotoUrl.trim(),
        ativo: form.ativo,
        caracteristicas: form.caracteristicas,
      });
      await dados.recarregar();
    });
    if (ok) setEditando(false);
  }

  /** Marca ou desmarca uma característica direto no cadastro. */
  async function alternarTrait(traitId: string) {
    if (!pessoa) return;
    const atuais = pessoa.caracteristicas ?? [];
    const proximas = atuais.includes(traitId)
      ? atuais.filter((x) => x !== traitId)
      : [...atuais, traitId];
    await enviar(async () => {
      await atualizarPessoa(id, { caracteristicas: proximas });
      await dados.recarregar();
    });
  }

  async function salvarNotas() {
    setNotasSalvas(false);
    const texto = notas ?? observacoesAtuais;
    const ok = await enviar(async () => {
      await salvarObservacoes(id, texto);
      await dados.recarregar();
    });
    if (ok) {
      setNotas(null);
      setNotasSalvas(true);
    }
  }

  if (dados.carregando) {
    return (
      <CorpoAdmin>
        <Carregando />
      </CorpoAdmin>
    );
  }

  if (dados.erro) {
    return (
      <CorpoAdmin>
        <ErroCarregamento erro={dados.erro} onTentarNovamente={dados.recarregar} />
      </CorpoAdmin>
    );
  }

  if (!pessoa) {
    return (
      <CorpoAdmin>
        <VoltarPara href="/admin/pessoas" rotulo="Pessoas" />
        <Vazio titulo="Pessoa não encontrada" descricao="O cadastro pode ter sido removido." />
      </CorpoAdmin>
    );
  }

  const desde = participacoes.length > 0 ? ano(participacoes[participacoes.length - 1].periodo) : null;
  const personagensAnteriores = Array.from(
    new Set(participacoes.map((p) => p.characterNome)),
  ).filter(Boolean);

  return (
    <>
      <TopoAdmin
        titulo={nomeCurto(pessoa.nome)}
        subtitulo={[pessoa.email, pessoa.telefone, desde ? `desde ${desde}` : null]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          editando ? undefined : (
            <Botao variante="ghost" onClick={abrirEdicao}>
              Editar cadastro
            </Botao>
          )
        }
      />

      <CorpoAdmin>
        <VoltarPara href="/admin/pessoas" rotulo="Pessoas" />

        <div className="mb-5 flex items-center gap-3.5">
          <Avatar nome={pessoa.nome} url={pessoa.fotoUrl} tamanho={40} />
          <Status tom={pessoa.ativo ? "positivo" : "neutro"}>
            {pessoa.ativo ? "Ativa no grupo" : "Inativa no grupo"}
          </Status>
          {personagem ? (
            <Tag tom="areia">
              {personagem.nome} · {ROLE_TYPE_LABEL[personagem.tipoPapel]}
            </Tag>
          ) : (
            <Tag>Não escalada na peça atual</Tag>
          )}
          {pessoa.cadastroCompletoEm ? null : (
            <Tag tom="aviso">Cadastro de primeiro acesso pendente</Tag>
          )}
        </div>

        {editando ? (
          <Cartao className="mb-5 max-w-xl px-4 py-4">
            <TituloSecao titulo="Editar cadastro" />
            <div className="space-y-3.5">
              <Campo etiqueta="Nome completo" obrigatorio>
                <Entrada
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="E-mail" obrigatorio dica="Usado para vincular a conta de acesso.">
                <Entrada
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Telefone">
                <Entrada
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  inputMode="tel"
                />
              </Campo>
              <Campo etiqueta="Foto">
                {/*
                  * Grava sozinha ao terminar o envio, sem esperar o "Salvar":
                  * o arquivo já subiu, e deixar a URL pendurada no formulário
                  * abriria a chance de a foto existir no Storage sem ninguém
                  * apontando para ela.
                  */}
                <EnviarFoto
                  caminho={caminhoDaFotoDoAtor(id)}
                  atual={form.fotoUrl}
                  onEnviada={(url) => salvarFoto(url)}
                  onRemovida={() => salvarFoto("")}
                  desabilitado={enviando}
                />
              </Campo>
              <div className="-mx-2">
                <Caixa
                  marcada={form.ativo}
                  onClick={() => setForm({ ...form, ativo: !form.ativo })}
                  descricao="Uma pessoa inativa continua no histórico das peças anteriores."
                >
                  Ativa no grupo
                </Caixa>
              </div>
              {erro ? <Aviso>{erro}</Aviso> : null}
              <div className="flex gap-2">
                <Botao onClick={() => void salvar()} disabled={enviando}>
                  {enviando ? "Salvando…" : "Salvar"}
                </Botao>
                <Botao variante="bare" onClick={() => setEditando(false)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          </Cartao>
        ) : null}

        <Abas
          className="mb-5"
          abas={[
            { chave: "geral", rotulo: "Visão geral" },
            { chave: "historico", rotulo: "Histórico", contagem: participacoes.length },
            { chave: "observacoes", rotulo: "Observações" },
          ]}
          ativa={aba}
          onTrocar={setAba}
        />

        {aba === "geral" ? (
          <div className="grid gap-4 min-[900px]:grid-cols-[1fr_1.1fr]">
            <Cartao className="px-4 py-4">
              <TituloSecao
                titulo="Características de atuação"
                descricao="Marque o que descreve a atuação da pessoa."
              />
              {traits.length === 0 ? (
                <p className="text-[13px] text-ink-caption">
                  Nenhuma característica cadastrada. Crie na tela Pessoas.
                </p>
              ) : (
                <div className="-mx-2">
                  {traits.map((t) => (
                    <Caixa
                      key={t.id}
                      marcada={Boolean(pessoa.caracteristicas?.includes(t.id))}
                      onClick={() => void alternarTrait(t.id)}
                      desabilitada={enviando}
                    >
                      {t.nome}
                    </Caixa>
                  ))}
                </div>
              )}
              {erro && !editando ? (
                <div className="mt-3">
                  <Aviso>{erro}</Aviso>
                </div>
              ) : null}
            </Cartao>

            <Cartao className="px-4 py-4">
              <TituloSecao
                titulo="Resumo"
                descricao={`${pluralizar(participacoes.length, "peça registrada", "peças registradas")} no histórico.`}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Eyebrow>Peças</Eyebrow>
                  <p className="fonte-num mt-1 text-[32px] leading-[38px] font-bold text-ink-heading">
                    {participacoes.length}
                  </p>
                </div>
                <div>
                  <Eyebrow>Personagens</Eyebrow>
                  <p className="fonte-num mt-1 text-[32px] leading-[38px] font-bold text-ink-heading">
                    {personagensAnteriores.length}
                  </p>
                </div>
              </div>
              {personagensAnteriores.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {personagensAnteriores.map((nome) => (
                    <Tag key={nome}>{nome}</Tag>
                  ))}
                </div>
              ) : null}

              <Divisor className="my-4" />

              <Eyebrow>Cadastro</Eyebrow>
              <dl className="mt-2">
                <Dado
                  rotulo="Nascimento"
                  valor={
                    pessoa.nascimento
                      ? `${dataLonga(pessoa.nascimento)}${
                          idade(pessoa.nascimento) !== null
                            ? ` · ${pluralizar(idade(pessoa.nascimento) as number, "ano", "anos")}`
                            : ""
                        }`
                      : "não informado"
                  }
                />
                {pessoa.nascimento && ehMenorDeIdade(pessoa.nascimento, MAIORIDADE) ? (
                  <Dado
                    rotulo="Responsável"
                    valor={
                      pessoa.responsavelNome
                        ? `${pessoa.responsavelNome}${
                            pessoa.responsavelTelefone ? ` · ${pessoa.responsavelTelefone}` : ""
                          }`
                        : "não informado"
                    }
                  />
                ) : null}
                <Dado
                  rotulo="Experiência"
                  valor={
                    pessoa.jaAtuou === true
                      ? `${pessoa.experiencia || "não informada"}${
                          pessoa.pecasAnteriores
                            ? ` · ${pessoa.pecasAnteriores} ${
                                pessoa.pecasAnteriores === "1" ? "peça" : "peças"
                              } antes daqui`
                            : ""
                        }`
                      : pessoa.jaAtuou === false
                        ? "primeira vez no teatro"
                        : "não informada"
                  }
                  ultima
                />
              </dl>
            </Cartao>
          </div>
        ) : null}

        {aba === "historico" ? (
          <Cartao className="px-4 py-4">
            <TituloSecao
              titulo="Histórico de participações"
              descricao="Registrado automaticamente quando uma peça é concluída."
            />
            {participacoes.length === 0 ? (
              <p className="text-[13px] leading-5 text-ink-caption">
                Nenhuma participação registrada ainda.
              </p>
            ) : (
              <ul>
                {participacoes.map((p) => (
                  <LinhaParticipacao key={p.id} participacao={p} />
                ))}
              </ul>
            )}
          </Cartao>
        ) : null}

        {aba === "observacoes" ? (
          <Cartao className="max-w-2xl px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] leading-6 font-bold text-ink-heading">
                Observações da direção
              </h2>
              <SeloDirecao />
            </div>
            <AreaTexto
              value={notas ?? observacoesAtuais}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Anotações internas sobre disponibilidade, evolução, preferências de papel…"
              className="min-h-[140px]"
            />
            <p className="mt-2 text-[12px] leading-[18px] text-ink-caption">
              Este texto nunca aparece para o participante.
            </p>
            {notasSalvas ? (
              <div className="mt-3">
                <Aviso tom="positivo">Observações salvas.</Aviso>
              </div>
            ) : null}
            {erro ? (
              <div className="mt-3">
                <Aviso>{erro}</Aviso>
              </div>
            ) : null}
            <div className="mt-3">
              <Botao onClick={() => void salvarNotas()} disabled={enviando}>
                {enviando ? "Salvando…" : "Salvar observações"}
              </Botao>
            </div>
          </Cartao>
        ) : null}
      </CorpoAdmin>
    </>
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
          ? "flex flex-wrap items-baseline justify-between gap-3 py-2"
          : "flex flex-wrap items-baseline justify-between gap-3 border-b border-stroke-list py-2"
      }
    >
      <dt className="text-[13px] leading-5 text-ink-caption">{rotulo}</dt>
      <dd className="text-[14px] leading-[21px] text-ink-heading">{valor}</dd>
    </div>
  );
}
