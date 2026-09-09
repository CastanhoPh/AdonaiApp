"use client";

/**
 * Cadastro de peça que já aconteceu.
 *
 * O caminho normal de uma peça — planejamento, escalação, ensaios, conclusão —
 * existe para acompanhar uma produção em andamento. Para peça antiga ele é só
 * trabalho: ninguém vai ensaiar o que já foi apresentado, e o que interessa é
 * que a participação de cada um entre no histórico.
 *
 * Por isso esta tela é um formulário só, e a peça nasce concluída. Roteiro não
 * é pedido: peça antiga raramente tem o texto à mão, e exigi-lo impediria de
 * registrar o que se lembra.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import { listarPessoas, registrarPecaAntiga, type PapelAntigo } from "@/lib/db";
import { hojeISO } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import { ROLE_TYPES, ROLE_TYPE_LABEL, type Person, type RoleType } from "@/lib/types";
import { CorpoAdmin, ErroCarregamento, TopoAdmin, VoltarPara } from "@/components/shell";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoLink,
  Campo,
  Cartao,
  Carregando,
  Entrada,
  Eyebrow,
  Selecao,
  TituloSecao,
} from "@/components/ui";

/** Linha em branco da lista de personagens. */
function papelVazio(): PapelAntigo {
  return { nome: "", tipoPapel: "coadjuvante", personId: "", personNome: "" };
}

export default function PecaAntiga() {
  const router = useRouter();
  const pessoas = useCarregar<Person[]>("pessoas-para-peca-antiga", () => listarPessoas(), []);
  const { enviando, erro, definirErro, enviar } = useEnvio();

  const [titulo, setTitulo] = useState("");
  const [nomeEvento, setNomeEvento] = useState("");
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [papeis, setPapeis] = useState<PapelAntigo[]>([papelVazio()]);
  const [registrada, setRegistrada] = useState<{ id: string; participacoes: number } | null>(null);

  const lista = pessoas.dados ?? [];

  function mudar(indice: number, campo: Partial<PapelAntigo>) {
    setPapeis(papeis.map((p, i) => (i === indice ? { ...p, ...campo } : p)));
  }

  function escolherPessoa(indice: number, personId: string) {
    const pessoa = lista.find((p) => p.id === personId);
    mudar(indice, { personId, personNome: pessoa?.nome ?? "" });
  }

  async function registrar() {
    const preenchidos = papeis.filter((p) => p.nome.trim());
    if (!titulo.trim()) {
      definirErro("Informe o nome da peça.");
      return;
    }
    if (!data) {
      definirErro("Informe a data em que a peça foi apresentada.");
      return;
    }
    if (data > hojeISO()) {
      definirErro("Esta data é no futuro. Para peça que ainda vai acontecer, use “Nova peça”.");
      return;
    }
    if (preenchidos.length === 0) {
      definirErro("Cadastre ao menos um personagem.");
      return;
    }

    const ok = await enviar(async () => {
      const r = await registrarPecaAntiga({
        titulo: titulo.trim(),
        nomeEvento: nomeEvento.trim(),
        dataApresentacao: data,
        local: local.trim(),
        descricao: descricao.trim(),
        papeis: preenchidos.map((p) => ({ ...p, nome: p.nome.trim() })),
      });
      setRegistrada({ id: r.playId, participacoes: r.participacoes });
    });
    if (!ok) setRegistrada(null);
  }

  function limpar() {
    setTitulo("");
    setNomeEvento("");
    setData("");
    setLocal("");
    setDescricao("");
    setPapeis([papelVazio()]);
    setRegistrada(null);
    definirErro(null);
  }

  if (pessoas.carregando) {
    return (
      <CorpoAdmin>
        <Carregando />
      </CorpoAdmin>
    );
  }
  if (pessoas.erro) {
    return (
      <CorpoAdmin>
        <ErroCarregamento erro={pessoas.erro} onTentarNovamente={pessoas.recarregar} />
      </CorpoAdmin>
    );
  }

  /*
   * Depois de registrar, a tela oferece cadastrar outra em vez de sair: quem
   * está subindo o acervo tem várias peças na mão, e voltar para a lista a cada
   * uma faria o dobro de cliques.
   */
  if (registrada) {
    return (
      <>
        <TopoAdmin titulo="Peça registrada" />
        <CorpoAdmin>
          <VoltarPara href="/admin/pecas" rotulo="Peças" />
          <Cartao className="px-5 py-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-state-positive">
                <CheckCircle size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[17px] leading-6 font-bold text-ink-heading">
                  “{titulo}” entrou no histórico
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-ink-body">
                  {registrada.participacoes === 0
                    ? "Nenhum personagem tinha alguém ligado, então nada foi para o histórico de ninguém. Abra a peça para escalar quem atuou."
                    : registrada.participacoes === 1
                      ? "1 participação registrada. Já aparece no histórico da pessoa."
                      : `${registrada.participacoes} participações registradas. Já aparecem no histórico de cada pessoa.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Botao onClick={limpar}>Registrar outra peça</Botao>
                  <BotaoLink
                    href={`/admin/pecas/detalhe?id=${registrada.id}`}
                    variante="ghost"
                  >
                    Abrir a peça
                  </BotaoLink>
                  <Botao variante="bare" onClick={() => router.push("/admin/pecas")}>
                    Ver todas as peças
                  </Botao>
                </div>
              </div>
            </div>
          </Cartao>
        </CorpoAdmin>
      </>
    );
  }

  return (
    <>
      <TopoAdmin
        titulo="Registrar peça antiga"
        subtitulo="Para peça que já foi apresentada. Entra direto no histórico de quem atuou."
      />

      <CorpoAdmin>
        <VoltarPara href="/admin/pecas" rotulo="Peças" />

        <div className="grid gap-4 min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Cartao className="px-4 py-4">
            <TituloSecao titulo="A peça" />
            <div className="space-y-3.5">
              <Campo etiqueta="Nome da peça" obrigatorio>
                <Entrada
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: O Filho Pródigo"
                />
              </Campo>
              <Campo
                etiqueta="Nome do evento"
                dica="Opcional. É o que dá contexto no histórico anos depois."
              >
                <Entrada
                  value={nomeEvento}
                  onChange={(e) => setNomeEvento(e.target.value)}
                  placeholder="Ex.: Congresso de Jovens 2023"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Data" obrigatorio>
                  <Entrada
                    type="date"
                    value={data}
                    max={hojeISO()}
                    onChange={(e) => setData(e.target.value)}
                  />
                </Campo>
                <Campo etiqueta="Local">
                  <Entrada
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    placeholder="Ex.: Templo sede"
                  />
                </Campo>
              </div>
              <Campo etiqueta="Descrição" dica="Opcional.">
                <AreaTexto
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Tema, proposta, o que foi essa peça."
                />
              </Campo>
            </div>
          </Cartao>

          <Cartao className="px-4 py-4">
            <TituloSecao
              titulo="Personagens"
              descricao="Quem atuou em cada papel. Deixe a pessoa em branco se não lembrar — o personagem fica registrado, mas não entra no histórico de ninguém."
            />

            <ul className="space-y-3">
              {papeis.map((papel, i) => (
                <li key={i} className="rounded-[10px] border border-stroke-list p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Eyebrow>Personagem {i + 1}</Eyebrow>
                    {papeis.length > 1 ? (
                      <Botao
                        variante="bare"
                        onClick={() => setPapeis(papeis.filter((_, x) => x !== i))}
                        className="gap-1.5"
                      >
                        <Trash size={14} />
                        Remover
                      </Botao>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <Campo etiqueta="Nome do personagem">
                      <Entrada
                        value={papel.nome}
                        onChange={(e) => mudar(i, { nome: e.target.value })}
                        placeholder="Ex.: Pai"
                      />
                    </Campo>
                    <div className="grid gap-3 min-[560px]:grid-cols-2">
                      <Campo etiqueta="Quem atuou">
                        <Selecao
                          value={papel.personId}
                          onChange={(e) => escolherPessoa(i, e.target.value)}
                        >
                          <option value="">Não lembro / não cadastrado</option>
                          {lista.map((pessoa) => (
                            <option key={pessoa.id} value={pessoa.id}>
                              {pessoa.nome}
                            </option>
                          ))}
                        </Selecao>
                      </Campo>
                      <Campo etiqueta="Tipo do papel">
                        <Selecao
                          value={papel.tipoPapel}
                          onChange={(e) => mudar(i, { tipoPapel: e.target.value as RoleType })}
                        >
                          {ROLE_TYPES.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {ROLE_TYPE_LABEL[tipo]}
                            </option>
                          ))}
                        </Selecao>
                      </Campo>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3">
              <Botao
                variante="ghost"
                onClick={() => setPapeis([...papeis, papelVazio()])}
                className="gap-1.5"
              >
                <Plus size={15} />
                Adicionar personagem
              </Botao>
            </div>
          </Cartao>
        </div>

        {erro ? (
          <div className="mt-4">
            <Aviso>{erro}</Aviso>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Botao onClick={() => void registrar()} disabled={enviando} altura="form">
            {enviando ? "Registrando…" : "Registrar no histórico"}
          </Botao>
          <Botao variante="bare" onClick={limpar} disabled={enviando}>
            Limpar
          </Botao>
        </div>
      </CorpoAdmin>
    </>
  );
}
