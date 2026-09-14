"use client";

/**
 * Tira os parágrafos de um arquivo `.docx`, no próprio navegador.
 *
 * `.docx` é um zip com XML dentro; o texto mora em `word/document.xml`, onde
 * cada `<w:p>` é um parágrafo e cada `<w:t>` um pedaço de texto dele — o Word
 * quebra uma frase em vários `<w:t>` sempre que a formatação muda no meio.
 *
 * Sem biblioteca: `DecompressionStream` descompacta, e o resto é ler o índice
 * do zip. Um leitor de zip pronto custaria uns 100 kB no pacote, que todo
 * participante baixaria para uma tela que só a direção abre, e raramente.
 *
 * Navegador sem `DecompressionStream` (Chrome antes da 103, Safari antes da
 * 16.4) recebe um erro que manda colar o texto — a tela de importação aceita
 * os dois caminhos justamente por isso.
 */

const ASSINATURA_CENTRAL = 0x02014b50;
const FIM_DO_INDICE = 0x06054b50;

interface Entrada {
  nome: string;
  comprimido: boolean;
  inicio: number;
  bytes: number;
}

/** Percorre o índice do zip, que fica no fim do arquivo. */
function lerIndice(visao: DataView, bytes: Uint8Array): Entrada[] {
  // O fim do índice tem tamanho variável (pode ter comentário), então é
  // procurado de trás para frente pela assinatura.
  let fim = -1;
  for (let i = visao.byteLength - 22; i >= 0; i--) {
    if (visao.getUint32(i, true) === FIM_DO_INDICE) {
      fim = i;
      break;
    }
  }
  if (fim === -1) throw new Error("Este arquivo não parece um .docx válido.");

  const quantas = visao.getUint16(fim + 10, true);
  let posicao = visao.getUint32(fim + 16, true);
  const entradas: Entrada[] = [];

  for (let i = 0; i < quantas; i++) {
    if (visao.getUint32(posicao, true) !== ASSINATURA_CENTRAL) break;
    const metodo = visao.getUint16(posicao + 10, true);
    const comprimidos = visao.getUint32(posicao + 20, true);
    const tamanhoNome = visao.getUint16(posicao + 28, true);
    const tamanhoExtra = visao.getUint16(posicao + 30, true);
    const tamanhoComentario = visao.getUint16(posicao + 32, true);
    const deslocamento = visao.getUint32(posicao + 42, true);
    const nome = new TextDecoder().decode(bytes.subarray(posicao + 46, posicao + 46 + tamanhoNome));

    /*
     * O cabeçalho local repete nome e extra com tamanhos próprios — e o extra
     * costuma ser diferente do que está no índice. Os dados começam depois
     * dele, então é preciso lê-lo para achar o início de verdade.
     */
    const nomeLocal = visao.getUint16(deslocamento + 26, true);
    const extraLocal = visao.getUint16(deslocamento + 28, true);
    entradas.push({
      nome,
      comprimido: metodo === 8,
      inicio: deslocamento + 30 + nomeLocal + extraLocal,
      bytes: comprimidos,
    });

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  return entradas;
}

async function inflar(pedaco: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Este navegador não consegue abrir .docx. Copie o texto do documento e cole no campo abaixo.",
    );
  }
  const fluxo = new Blob([pedaco as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Os parágrafos do documento, na ordem, já sem marcação. */
export async function paragrafosDoDocx(arquivo: File): Promise<string[]> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const visao = new DataView(bytes.buffer);
  const entrada = lerIndice(visao, bytes).find((e) => e.nome === "word/document.xml");
  if (!entrada) throw new Error("Não encontrei o texto dentro do arquivo. Ele é mesmo um .docx?");

  const cru = bytes.subarray(entrada.inicio, entrada.inicio + entrada.bytes);
  const xml = new TextDecoder("utf-8").decode(entrada.comprimido ? await inflar(cru) : cru);

  const paragrafos: string[] = [];
  for (const [, corpo] of xml.matchAll(/<w:p[ >]([\s\S]*?)<\/w:p>/g)) {
    let texto = "";
    for (const [, pedaco] of corpo.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
      texto += pedaco;
    }
    // `<w:br/>` é quebra de linha dentro do mesmo parágrafo.
    if (/<w:br\s*\/>/.test(corpo) && !texto) texto = "";
    paragrafos.push(desescapar(texto));
  }
  return paragrafos;
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}
