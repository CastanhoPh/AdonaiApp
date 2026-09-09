"use client";

/**
 * Envio de imagens para o Firebase Storage.
 *
 * Organização dos arquivos:
 *
 *   atores/{personId}/perfil.jpg
 *   pecas/{playId}/capa.jpg
 *   pecas/{playId}/{characterId}/foto.jpg
 *
 * O Storage não tem pasta de verdade — o caminho é só o nome do arquivo, e a
 * barra é o que o console mostra como hierarquia. Então "criar a pasta de um
 * ator" é enviar o primeiro arquivo dentro dela; não existe pasta vazia.
 *
 * Os nomes são fixos, não sorteados. Trocar a foto sobrescreve a anterior em
 * vez de deixar um arquivo órfão cobrando armazenamento para sempre, e o
 * caminho de qualquer foto é dedutível a partir do id.
 *
 * Tudo é reconvertido para JPEG antes de subir, por isso a extensão é sempre a
 * mesma. Foto de celular tem 3 a 6 MB e o elenco abre o app no 4G do ensaio:
 * subir o original gastaria dados de quem envia e de todos que veem depois.
 */
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type StorageError,
} from "firebase/storage";
import { storage } from "./firebase";

export function caminhoDaFotoDoAtor(personId: string): string {
  return `atores/${personId}/perfil.jpg`;
}

export function caminhoDaCapaDaPeca(playId: string): string {
  return `pecas/${playId}/capa.jpg`;
}

export function caminhoDaFotoDoPersonagem(playId: string, characterId: string): string {
  return `pecas/${playId}/${characterId}/foto.jpg`;
}

/** Maior lado da imagem depois do redimensionamento, por tipo de uso. */
export const LADO_RETRATO = 1024;
export const LADO_CENA = 1600;

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
