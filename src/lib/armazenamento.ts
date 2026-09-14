"use client";

/**
 * Envio de imagens para o Firebase Storage.
 *
 * Organização dos arquivos:
 *
 *   atores/{personId}/{nome}.jpg          e {nome}-mini.jpg
 *   pecas/{playId}/{titulo}.jpg           e {titulo}-mini.jpg
 *   pecas/{playId}/{characterId}/{nome}.jpg
 *
 * O Storage não tem pasta de verdade — o caminho é só o nome do arquivo, e a
 * barra é o que o console mostra como hierarquia. Então "criar a pasta de um
 * ator" é enviar o primeiro arquivo dentro dela; não existe pasta vazia.
 *
 * A pasta é o id e o arquivo leva o nome. O id sustenta a permissão e não pode
 * mudar; o nome é rótulo, para quem abre o Storage reconhecer o que está
 * vendo. Como o nome muda quando alguém é renomeado, cada pasta guarda a
 * imagem de uma coisa só e é esvaziada antes de um envio novo — ver
 * `limparPasta`.
 *
 * Toda imagem que aparece pequena em alguma lista sobe duas vezes, grande e
 * miniatura, na mesma escolha de arquivo. Gerar a pequena depois obrigaria a
 * baixar a grande de volta.
 *
 * Tudo é reconvertido para JPEG antes de subir, por isso a extensão é sempre a
 * mesma. Foto de celular tem 3 a 6 MB e o elenco abre o app no 4G do ensaio:
 * subir o original gastaria dados de quem envia e de todos que veem depois.
 */
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable,
  type StorageError,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * O nome de quem é a imagem, em forma de nome de arquivo.
 *
 * Sem acento, minúsculo e com hífen no lugar do espaço. Serve para quem abre o
 * Storage reconhecer o arquivo sem precisar traduzir id nenhum.
 *
 * Note que isto **não** entra no nome da pasta. A pasta continua sendo o id,
 * porque é ela que a regra de segurança compara com o token para decidir quem
 * pode trocar a foto — e identificador que sustenta permissão não pode depender
 * de como alguém se chama hoje. Aqui é só rótulo.
 */
export function paraNomeDeArquivo(texto: string, reserva: string): string {
  const limpo = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // Nome só de símbolos, ou vazio, cairia num arquivo chamado "" — daí a reserva.
  return limpo || reserva;
}

export function caminhoDaFotoDoAtor(personId: string, nome: string): string {
  return `atores/${personId}/${paraNomeDeArquivo(nome, "perfil")}.jpg`;
}

/**
 * A mesma foto, pequena, para os círculos das listas.
 *
 * O retrato sobe com 1024 de lado porque a ficha mostra ele grande. Só que
 * quem aparece o tempo todo é o círculo de 28 pixels da lista de elenco — e
 * baixar 216 kB para desenhar 28 pixels é o que fazia a tela de Pessoas
 * demorar a completar no 4G.
 */
export function caminhoDaMiniaturaDoAtor(personId: string, nome: string): string {
  return `atores/${personId}/${paraNomeDeArquivo(nome, "perfil")}-mini.jpg`;
}

export function caminhoDaCapaDaPeca(playId: string, titulo: string): string {
  return `pecas/${playId}/${paraNomeDeArquivo(titulo, "capa")}.jpg`;
}

/**
 * A mesma capa, pequena, para a lista de peças.
 *
 * A capa sobe com 1600 de lado porque um dia vai aparecer grande. Quem a
 * mostra hoje é o quadrado de 64 pixels da lista da direção, e eram 75 kB por
 * peça para desenhar isso — a tela inteira baixava meio megabyte de imagem.
 */
export function caminhoDaMiniaturaDaCapa(playId: string, titulo: string): string {
  return `pecas/${playId}/${paraNomeDeArquivo(titulo, "capa")}-mini.jpg`;
}

export function caminhoDaFotoDoPersonagem(
  playId: string,
  characterId: string,
  nome: string,
): string {
  return `pecas/${playId}/${characterId}/${paraNomeDeArquivo(nome, "foto")}.jpg`;
}

/**
 * Apaga os arquivos que estão diretamente na pasta, sem entrar nas de dentro.
 *
 * Com o nome no arquivo, o caminho deixou de ser fixo: trocar a foto depois de
 * uma renomeação escreveria num arquivo novo e deixaria o antigo ocupando
 * espaço para sempre. Cada pasta aqui guarda a imagem de uma coisa só, então
 * limpar antes de subir mantém a promessa de "uma imagem atual por pasta".
 *
 * Não desce nas subpastas de propósito: a pasta de uma peça contém as pastas
 * dos personagens, e a capa não tem nada a ver com elas.
 */
export async function limparPasta(prefixo: string): Promise<void> {
  try {
    const { items } = await listAll(ref(storage, prefixo));
    await Promise.all(items.map((item) => deleteObject(item).catch(() => {})));
  } catch {
    // Sem permissão de listagem ou pasta inexistente: nada a limpar.
  }
}

/** Maior lado da imagem depois do redimensionamento, por tipo de uso. */
export const LADO_RETRATO = 1024;
export const LADO_CENA = 1600;
/*
 * 128 para círculos de até 56 pixels. O dobro do maior uso cobre tela de alta
 * densidade, que é todo celular, e ainda cabe em poucos kB.
 */
export const LADO_MINIATURA = 128;
/* 192 pela mesma conta, para o quadrado de 64 da lista de peças. */
export const LADO_MINIATURA_CAPA = 192;

const TAMANHO_MAXIMO = 12 * 1024 * 1024;

/** Mensagem pronta quando o arquivo escolhido não serve. */
export function problemaComOArquivo(arquivo: File): string | null {
  if (!arquivo.type.startsWith("image/")) {
    return "Escolha uma imagem. Esse arquivo é de outro tipo.";
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return "A imagem tem mais de 12 MB. Escolha uma menor.";
  }
  return null;
}

/**
 * Reduz a imagem e devolve um JPEG.
 *
 * `createImageBitmap` respeita a orientação EXIF quando recebe
 * `imageOrientation: "from-image"` — sem isso, retrato tirado no celular sobe
 * de lado, que é o defeito clássico de upload de foto.
 */
async function reduzir(arquivo: File, ladoMaximo: number): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a imagem neste navegador.");
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    tela.toBlob(resolver, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Não foi possível preparar a imagem neste navegador.");
  return blob;
}

/** Traduz o erro do Storage para algo que a direção e o elenco entendam. */
function mensagemDoStorage(erro: unknown): string {
  const codigo = (erro as StorageError)?.code ?? "";
  if (codigo === "storage/unauthorized") {
    return "Você não tem permissão para trocar esta foto.";
  }
  if (codigo === "storage/canceled") return "Envio cancelado.";
  if (codigo === "storage/retry-limit-exceeded") {
    return "A conexão não aguentou o envio. Tente de novo com sinal melhor.";
  }
  return "Não foi possível enviar a foto. Tente de novo.";
}

export interface ResultadoEnvio {
  url: string;
  bytes: number;
}

/**
 * Envia a imagem e devolve a URL pública dela.
 *
 * `aoProgredir` recebe de 0 a 100. Vale a pena mostrar: no 4G de um ginásio,
 * mesmo 300 KB levam alguns segundos, e sem barra a tela parece travada.
 */
export async function enviarImagem(
  caminho: string,
  arquivo: File,
  { ladoMaximo = LADO_RETRATO, aoProgredir }: { ladoMaximo?: number; aoProgredir?: (por: number) => void } = {},
): Promise<ResultadoEnvio> {
  const problema = problemaComOArquivo(arquivo);
  if (problema) throw new Error(problema);

  const reduzida = await reduzir(arquivo, ladoMaximo);
  const tarefa = uploadBytesResumable(ref(storage, caminho), reduzida, {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });

  return new Promise<ResultadoEnvio>((resolver, rejeitar) => {
    tarefa.on(
      "state_changed",
      (estado) => {
        if (aoProgredir && estado.totalBytes > 0) {
          aoProgredir(Math.round((estado.bytesTransferred / estado.totalBytes) * 100));
        }
      },
      (erro) => rejeitar(new Error(mensagemDoStorage(erro))),
      async () => {
        try {
          resolver({ url: await getDownloadURL(tarefa.snapshot.ref), bytes: reduzida.size });
        } catch (erro) {
          rejeitar(new Error(mensagemDoStorage(erro)));
        }
      },
    );
  });
}

/** Apaga o arquivo. Não reclama se ele já não existe. */
export async function removerImagem(caminho: string): Promise<void> {
  try {
    await deleteObject(ref(storage, caminho));
  } catch (erro) {
    if ((erro as StorageError)?.code === "storage/object-not-found") return;
    throw new Error(mensagemDoStorage(erro));
  }
}
