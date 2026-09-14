"use client";

/**
 * Traz um roteiro de fora para dentro da peça.
 *
 * Digitar o roteiro linha a linha no editor é viável para uma cena e inviável
 * para uma peça — os roteiros do grupo têm mais de cem linhas cada, e todos
 * já existem escritos em `.docx`.
 *
 * Duas etapas, e a segunda é a que importa. A primeira lê o arquivo; a segunda
 * pergunta **quem é quem**. O roteiro chama pelo papel ("Principal", "Mãe") e
 * o cadastro chama pelo nome ("Amanda", "Mãe da Amanda"), e casar os dois é
 * decisão da direção, não adivinhação: uma fala no personagem errado é uma
 * fala que some do roteiro de quem deveria dizê-la, sem erro nenhum aparecer.
 */
import { useRef, useState } from "react";
import { FileArrowUp, Warning } from "@phosphor-icons/react";
import { criarPersonagem, importarRoteiro } from "@/lib/db";
import { paragrafosDoDocx } from "@/lib/docx";
import { lerRoteiro, type RoteiroLido } from "@/lib/roteiro-importado";
import { useEnvio } from "@/lib/hooks";
import { pluralizar } from "@/lib/format";
import type { Character } from "@/lib/types";
import {
  AreaTexto,
  Aviso,
  Botao,
  Caixa,
  Campo,
  Divisor,
  Eyebrow,
  Modal,
  Selecao,
  Tag,
} from "@/components/ui";

/** Escolha feita para cada nome que fala no arquivo. */
const CRIAR = "__criar__";
const IGNORAR = "__ignorar__";

export function ImportarRoteiro({
  playId,
  personagens,
  falasExistentes,
  aberto,
  onFechar,
  onImportado,
}: {
  playId: string;
  personagens: Character[];
  /** Quantas linhas a peça já tem, para avisar antes de substituir. */
  falasExistentes: number;
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => Promise<void>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const { enviando, erro, definirErro, enviar } = useEnvio();
  const [lido, setLido] = useState<RoteiroLido | null>(null);
  const [colado, setColado] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [substituir, setSubstituir] = useState(false);

  function analisar(paragrafos: string[]) {
    const resultado = lerRoteiro(paragrafos);
    if (resultado.linhas.length === 0) {
      definirErro(
        "Não encontrei nenhuma cena. O roteiro precisa ter linhas como “Cena 1” separando as cenas.",
      );
      return;
    }
    setLido(resultado);
    /*
     * Pré-seleciona quando o nome bate exatamente com um personagem cadastrado.
     * Só igualdade — parecido não conta, porque "Mãe" e "Mãe da Amanda" são
     * parecidos e "Pai da Amanda" e "Pai do Thiago" também.
     */
    const inicial: Record<string, string> = {};
    for (const { nome } of resultado.falantes) {
      const igual = personagens.find(
        (p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
      );
      inicial[nome] = igual ? igual.id : "";
    }
    setEscolhas(inicial);
  }

  async function escolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    definirErro(null);
    try {
      analisar(await paragrafosDoDocx(arquivo));
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui ler este arquivo.");
    }
  }

  function analisarColado() {
    definirErro(null);
    analisar(colado.split(/\r?\n/));
  }

  const semEscolha = lido?.falantes.filter((f) => !escolhas[f.nome]).length ?? 0;
  const aCriar = lido?.falantes.filter((f) => escolhas[f.nome] === CRIAR) ?? [];
  const aIgnorar = lido?.falantes.filter((f) => escolhas[f.nome] === IGNORAR) ?? [];

  async function confirmar() {
    if (!lido) return;
    if (semEscolha > 0) {
      definirErro("Diga quem é cada personagem antes de importar.");
      return;
    }
    if (falasExistentes > 0 && !substituir) {
      definirErro(
        "Esta peça já tem roteiro. Marque a substituição, ou cancele e apague o que está lá.",
      );
      return;
    }

    const ok = await enviar(async () => {
      /*
       * Os personagens que faltam nascem antes das falas.
       *
       * Se a criação falhar, nada do roteiro entrou — melhor que um roteiro
       * gravado com falas apontando para personagens que não existem.
       */
      const mapa: Record<string, { ids: string[]; nomes: string[] }> = {};
      let ordem = personagens.length;
      for (const { nome } of lido.falantes) {
        const escolha = escolhas[nome];
        if (escolha === IGNORAR) {
          mapa[nome] = { ids: [], nomes: [nome] };
          continue;
        }
        if (escolha === CRIAR) {
          const id = await criarPersonagem(playId, {
            nome,
            descricao: "",
            tipoPapel: "figurante",
            personId: null,
            personNome: "",
            situacao: "pendente",
            observacoes: "",
            imagemUrl: "",
            ordem: ordem++,
          });
          mapa[nome] = { ids: [id], nomes: [nome] };
          continue;
        }
        const personagem = personagens.find((p) => p.id === escolha);
        mapa[nome] = { ids: [escolha], nomes: [personagem?.nome ?? nome] };
      }

      await importarRoteiro(playId, lido.linhas, mapa, { substituir });
      await onImportado();
    });

    if (ok) {
      setLido(null);
      setColado("");
      setSubstituir(false);
      onFechar();
    }
  }

  const falas = lido?.linhas.filter((l) => l.tipo === "fala").length ?? 0;
  const acoes = lido?.linhas.filter((l) => l.tipo === "acao").length ?? 0;
  const narracoes = lido?.linhas.filter((l) => l.tipo === "narracao").length ?? 0;

  return (
    <Modal
      titulo="Importar roteiro"
      aberto={aberto}
      onFechar={onFechar}
      largura="lg"
      rodape={
        <>
          <Botao variante="bare" onClick={onFechar}>
            Cancelar
          </Botao>
          {lido ? (
            <Botao onClick={() => void confirmar()} disabled={enviando}>
              {enviando ? "Importando…" : `Importar ${pluralizar(lido.linhas.length, "linha", "linhas")}`}
            </Botao>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {!lido ? (
          <>
            <p className="text-[13px] leading-5 text-ink-body">
              O roteiro precisa separar as cenas com linhas como <strong>Cena 1</strong>, escrever
              as falas como <strong>Personagem: texto</strong> e as indicações de cena{" "}
              <strong>(entre parênteses)</strong>.
            </p>

            <input
              ref={entrada}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={escolherArquivo}
            />
            <Botao variante="ghost" onClick={() => entrada.current?.click()} className="gap-2">
              <FileArrowUp size={16} />
              Escolher arquivo .docx
            </Botao>

            <Divisor />

            <Campo
              etiqueta="Ou cole o texto"
              dica="Serve para roteiro em outro formato: abra o documento, selecione tudo e cole aqui."
            >
              <AreaTexto
                rows={6}
                value={colado}
                onChange={(e) => setColado(e.target.value)}
                placeholder={"Cena 1\n(A cena começa com…)\nMaria: Bom dia."}
              />
            </Campo>
            {colado.trim() ? (
              <Botao variante="ghost" onClick={analisarColado}>
                Ler o texto colado
              </Botao>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Tag tom="positivo">{pluralizar(lido.cenas, "cena", "cenas")}</Tag>
              <Tag>{pluralizar(falas, "fala", "falas")}</Tag>
              <Tag>{pluralizar(acoes, "indicação de cena", "indicações de cena")}</Tag>
              {narracoes > 0 ? <Tag tom="aviso">{pluralizar(narracoes, "narração", "narrações")}</Tag> : null}
            </div>

            <div>
              <Eyebrow>Quem é quem</Eyebrow>
              <p className="mt-1 mb-3 text-[13px] leading-5 text-ink-caption">
                À esquerda o nome como está no roteiro; à direita o personagem desta peça. É este
                vínculo que faz a fala aparecer destacada para quem está escalado.
              </p>
              <ul className="space-y-2">
                {lido.falantes.map((falante) => (
                  <li key={falante.nome} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-[130px] flex-1 text-[14px] leading-[21px] text-ink-heading">
                      {falante.nome}
                      <span className="ml-1.5 text-[12px] text-ink-caption">
                        {falante.falas} {falante.falas === 1 ? "fala" : "falas"}
                      </span>
                    </span>
                    <Selecao
                      value={escolhas[falante.nome] ?? ""}
                      onChange={(e) =>
                        setEscolhas((a) => ({ ...a, [falante.nome]: e.target.value }))
                      }
                      aria-label={`Personagem de ${falante.nome}`}
                      className="h-9 w-[220px] text-[13px] max-sm:w-full"
                    >
                      <option value="">Escolha…</option>
                      {personagens.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                          {p.personNome ? ` — ${p.personNome}` : ""}
                        </option>
                      ))}
                      <option value={CRIAR}>+ Criar “{falante.nome}”</option>
                      <option value={IGNORAR}>Deixar sem personagem</option>
                    </Selecao>
                  </li>
                ))}
              </ul>
            </div>

            {aCriar.length > 0 ? (
              <Aviso tom="info">
                {pluralizar(aCriar.length, "personagem será criado", "personagens serão criados")}{" "}
                sem ator: {aCriar.map((f) => f.nome).join(", ")}. Escale na aba Elenco.
              </Aviso>
            ) : null}

            {aIgnorar.length > 0 ? (
              <Aviso>
                {aIgnorar.map((f) => f.nome).join(", ")} ficará sem vínculo — essas falas não serão
                destacadas para ninguém.
              </Aviso>
            ) : null}

            {lido.ignoradas.length > 0 ? (
              <div>
                <Eyebrow>Fora do roteiro</Eyebrow>
                <p className="mt-1 text-[13px] leading-5 text-ink-caption">
                  {pluralizar(lido.ignoradas.length, "linha veio", "linhas vieram")} antes da
                  primeira cena e não {lido.ignoradas.length === 1 ? "será importada" : "serão importadas"}:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {lido.ignoradas.slice(0, 5).map((t, i) => (
                    <li key={i} className="text-[12px] leading-[18px] text-ink-caption italic">
                      “{t.slice(0, 90)}”
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {falasExistentes > 0 ? (
              <div className="rounded-[8px] border border-state-warning/50 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-ink-heading">
                  <Warning size={15} />
                  Esta peça já tem {pluralizar(falasExistentes, "linha", "linhas")}
                </div>
                <Caixa
                  marcada={substituir}
                  onClick={() => setSubstituir(!substituir)}
                  descricao="O roteiro que está aqui será apagado e trocado pelo importado. Não tem como desfazer."
                >
                  Substituir o roteiro atual
                </Caixa>
              </div>
            ) : null}

            <p className="text-[12px] leading-[18px] text-ink-caption">
              Importar não publica: o roteiro entra como rascunho, você confere no editor e publica
              quando estiver certo.
            </p>
          </>
        )}

        {erro ? <Aviso>{erro}</Aviso> : null}
      </div>
    </Modal>
  );
}
