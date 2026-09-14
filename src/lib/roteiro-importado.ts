/**
 * Lê um roteiro escrito em texto e devolve as linhas que o app guarda.
 *
 * Roteiro não tem formato padronizado — cada grupo escreve de um jeito. Este
 * analisador foi feito em cima dos roteiros do teatro do Aliança, que seguem
 * uma forma consistente:
 *
 *     Cena 1
 *     (A cena começa com a Principal sentada na sala de aula.)
 *     Principal:Nossa, que prova difícil...
 *     Pai e Mãe:Você não devia ter nascido!
 *
 * Ou seja: cabeçalho de cena numerado, rubrica entre parênteses, e fala no
 * formato `Quem:texto` — às vezes sem espaço depois dos dois-pontos.
 *
 * O que ele **não** faz é adivinhar personagem. Os nomes que saem daqui são os
 * do papel ("Principal", "Mãe"), que raramente coincidem com os do cadastro
 * ("Amanda", "Mãe da Amanda"); quem casa os dois é a direção, na tela de
 * importação. Adivinhar por semelhança de texto acertaria na maioria e erraria
 * em silêncio na minoria — e uma fala no personagem errado é uma fala que some
 * do roteiro de quem deveria dizê-la.
 */
import type { LineKind } from "./types";

/** Uma linha lida do arquivo, antes de virar documento. */
export interface LinhaLida {
  ato: number;
  cena: number;
  cenaTitulo: string;
  tipo: LineKind;
  /** O nome como está escrito no roteiro. Vazio em narração e ação. */
  quem: string;
  texto: string;
}

export interface RoteiroLido {
  linhas: LinhaLida[];
  /** Nomes que falam, na ordem de aparição, com quantas falas cada um tem. */
  falantes: { nome: string; falas: number }[];
  cenas: number;
  /** Parágrafos que não encaixaram em nenhum padrão — título, notas soltas. */
  ignoradas: string[];
}

/*
 * `Cena 3`, `CENA 3`, `Cena 3 — O retorno`, `Cena 3: O retorno`.
 * O título é opcional: nos roteiros do grupo as cenas não têm nome.
 */
const CENA = /^cena\s+(\d+)\s*[—–\-:.]?\s*(.*)$/i;
const ATO = /^ato\s+([ivxlc]+|\d+)\s*[—–\-:.]?\s*(.*)$/i;

/** Rubrica: o parágrafo inteiro entre parênteses. */
const RUBRICA = /^\(([\s\S]*)\)$/;

/*
 * `Quem: texto`.
 *
 * O limite de 40 caracteres antes dos dois-pontos é o que separa uma fala de
 * uma frase que por acaso tem dois-pontos no meio. Nome de personagem é curto;
 * "Ele olhou para a plateia e disse: nunca mais" não é fala de ninguém.
 */
const FALA = /^([^:]{1,40}):\s*([\s\S]+)$/;

/** Números romanos dos atos, que é como roteiro costuma escrevê-los. */
const ROMANOS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

function numeroDoAto(bruto: string): number {
  const limpo = bruto.trim().toLowerCase();
  return ROMANOS[limpo] ?? Number(limpo) ?? 1;
}

/**
 * Lê os parágrafos e devolve o roteiro.
 *
 * Recebe parágrafos, não um texto corrido: em `.docx` a quebra de parágrafo é
 * a unidade real, e uma fala longa pode ter quebra de linha dentro dela sem
 * deixar de ser uma fala só.
 */
export function lerRoteiro(paragrafos: string[]): RoteiroLido {
  const linhas: LinhaLida[] = [];
  const ignoradas: string[] = [];
  const contagem = new Map<string, number>();

  let ato = 1;
  let cena = 0;
  let cenaTitulo = "";

  for (const bruto of paragrafos) {
    const texto = bruto.replace(/ /g, " ").trim();
    if (!texto) continue;

    const daAto = ATO.exec(texto);
    if (daAto) {
      ato = numeroDoAto(daAto[1]);
      // Ato novo recomeça a numeração de cenas, como no papel.
      cena = 0;
      continue;
    }

    const daCena = CENA.exec(texto);
    if (daCena) {
      cena = Number(daCena[1]);
      cenaTitulo = daCena[2].trim();
      continue;
    }

    /*
     * Antes da primeira cena não há onde pendurar a linha.
     *
     * Roteiro costuma abrir com título ou nota de elenco, e é o caso aqui:
     * "Roteiro — Elenco Mulheres". Em vez de inventar uma cena 1 e misturar
     * cabeçalho com texto de peça, essas linhas voltam em `ignoradas`, para a
     * direção ver o que ficou de fora.
     */
    if (cena === 0) {
      ignoradas.push(texto);
      continue;
    }

    const daRubrica = RUBRICA.exec(texto);
    if (daRubrica) {
      linhas.push({ ato, cena, cenaTitulo, tipo: "acao", quem: "", texto: daRubrica[1].trim() });
      continue;
    }

    const daFala = FALA.exec(texto);
    if (daFala) {
      const quem = daFala[1].trim();
      linhas.push({ ato, cena, cenaTitulo, tipo: "fala", quem, texto: daFala[2].trim() });
      contagem.set(quem, (contagem.get(quem) ?? 0) + 1);
      continue;
    }

    /*
     * Sobrou: parágrafo dentro de uma cena que não é rubrica nem fala. Entra
     * como narração, que é o tipo para texto sem dono — perder o parágrafo
     * seria pior, e a direção vê o tipo e corrige no editor se for o caso.
     */
    linhas.push({ ato, cena, cenaTitulo, tipo: "narracao", quem: "", texto });
  }

  const vistos = new Set<string>();
  const falantes: RoteiroLido["falantes"] = [];
  for (const linha of linhas) {
    if (linha.tipo !== "fala" || vistos.has(linha.quem)) continue;
    vistos.add(linha.quem);
    falantes.push({ nome: linha.quem, falas: contagem.get(linha.quem) ?? 0 });
  }

  const cenas = new Set(linhas.map((l) => `${l.ato}-${l.cena}`)).size;
  return { linhas, falantes, cenas, ignoradas };
}
