"use client";

/**
 * A ficha de interpretação de um personagem.
 *
 * Campos com nome no lugar de dois textos livres. `descricao` e `observacoes`
 * davam conta de guardar, não de perguntar: a direção escrevia o que lembrava,
 * na ordem que vinha, e cada personagem acabava com uma coisa diferente. Um
 * campo chamado "motivação" é uma pergunta feita — quem preenche vê o que
 * falta.
 *
 * Grava ao sair do campo, como o editor de roteiro: são sete campos de texto
 * longo, e um botão de salvar no fim significa perder tudo ao fechar a tela
 * sem querer.
 */
import { useState } from "react";
import { atualizarPersonagem } from "@/lib/db";
import { useEnvio } from "@/lib/hooks";
import type { Character, Interpretacao } from "@/lib/types";
import { AreaTexto, Aviso, Campo, Entrada, Eyebrow } from "@/components/ui";

/*
 * A ordem é a de quem monta um personagem, não a alfabética: quem é, como
 * fala, o que quer, para onde vai, com quem, e por fim o que a direção usa
 * para explicar o tom.
 */
const CAMPOS: {
  chave: keyof Interpretacao;
  etiqueta: string;
  dica: string;
  longo: boolean;
  exemplo?: string;
}[] = [
  {
    chave: "idade",
    etiqueta: "Idade do personagem",
    dica: "Raramente é a idade de quem o faz — e muda como ele anda e fala.",
    longo: false,
    exemplo: "uns 45 anos",
  },
  {
    chave: "personalidade",
    etiqueta: "Personalidade",
    dica: "Como ele é quando ninguém está pedindo nada dele.",
    longo: true,
  },
  {
    chave: "estiloDeFala",
    etiqueta: "Como fala",
    dica: "Ritmo, vocabulário, o que faz quando fica nervoso.",
    longo: true,
    exemplo: "Fala devagar, escolhe as palavras. Quando se irrita, encurta as frases.",
  },
  {
    chave: "motivacao",
    etiqueta: "O que ele quer",
    dica: "É o que move a cena. Sem isso o ator não tem o que perseguir.",
    longo: true,
  },
  {
    chave: "arco",
    etiqueta: "Arco",
    dica: "Onde começa e onde chega — o que muda nele do início ao fim.",
    longo: true,
  },
  {
    chave: "relacoes",
    etiqueta: "Relações",
    dica: "O que ele é de cada um, e o que está mal resolvido.",
    longo: true,
    exemplo: "Irmã mais velha da Amanda. Não se falam há dois anos.",
  },
  {
    chave: "referencias",
    etiqueta: "Referências",
    dica: "Filme, música, pessoa: o que você usa para explicar o tom.",
    longo: true,
  },
];

export function FichaInterpretacao({
  playId,
  personagem,
  onSalvo,
}: {
  playId: string;
  personagem: Character;
  onSalvo: () => Promise<void>;
}) {
  const { enviando, erro, enviar } = useEnvio();
  /** Texto em edição por campo; some ao gravar. */
  const [rascunhos, setRascunhos] = useState<Partial<Interpretacao>>({});

  const atual = personagem.interpretacao ?? {};

  async function gravar(chave: keyof Interpretacao) {
    const novo = rascunhos[chave];
    if (novo === undefined || novo === (atual[chave] ?? "")) return;
    await enviar(async () => {
      await atualizarPersonagem(playId, personagem.id, {
        interpretacao: { ...atual, [chave]: novo.trim() },
      });
      await onSalvo();
    });
    setRascunhos((r) => {
      const copia = { ...r };
      delete copia[chave];
      return copia;
    });
  }

  const preenchidos = CAMPOS.filter(({ chave }) => (atual[chave] ?? "").trim()).length;

  return (
    <div className="space-y-3.5">
      <div>
        <Eyebrow>Ficha de interpretação</Eyebrow>
        <p className="mt-1 text-[13px] leading-5 text-ink-caption">
          É o que o ator lê para construir o personagem — {preenchidos} de {CAMPOS.length}{" "}
          preenchidos. Grava sozinho ao sair de cada campo.
        </p>
      </div>

      {CAMPOS.map(({ chave, etiqueta, dica, longo, exemplo }) => (
        <Campo key={chave} etiqueta={etiqueta} dica={dica}>
          {longo ? (
            <AreaTexto
              rows={2}
              value={rascunhos[chave] ?? atual[chave] ?? ""}
              placeholder={exemplo}
              disabled={enviando}
              onChange={(e) => setRascunhos((r) => ({ ...r, [chave]: e.target.value }))}
              onBlur={() => void gravar(chave)}
            />
          ) : (
            <Entrada
              value={rascunhos[chave] ?? atual[chave] ?? ""}
              placeholder={exemplo}
              disabled={enviando}
              onChange={(e) => setRascunhos((r) => ({ ...r, [chave]: e.target.value }))}
              onBlur={() => void gravar(chave)}
            />
          )}
        </Campo>
      ))}

      {erro ? <Aviso>{erro}</Aviso> : null}
    </div>
  );
}
