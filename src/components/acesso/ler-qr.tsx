"use client";

/**
 * Leitor de QR code do convite.
 *
 * Dois decodificadores, na ordem de preferência:
 *
 * 1. `BarcodeDetector`, do próprio navegador. É nativo e não custa download,
 *    mas o suporte é estreito: existe no Chrome do Android, não existe no
 *    Safari do iPhone e não existe no Chrome de Windows. Dependendo só dele, o
 *    botão de escanear desapareceria para a maior parte do grupo.
 *
 * 2. jsQR, em JavaScript, carregado sob demanda quando o nativo não está lá.
 *    São algumas dezenas de kB que só descem quando a pessoa abre a câmera —
 *    ninguém que faz login paga por isso.
 *
 * O QR carrega um link, então a câmera nativa do celular continua sendo um
 * caminho válido, e o código segue digitável na tela anterior. O leitor é
 * conveniência, nunca a única porta.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { Aviso, Botao } from "@/components/ui";

/** Recorte do `BarcodeDetector`, que ainda não está nos tipos do TypeScript. */
interface DetectorNativo {
  detect(fonte: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface ConstrutorNativo {
  new (opcoes: { formats: string[] }): DetectorNativo;
}

function nativoDisponivel(): ConstrutorNativo | null {
  if (typeof window === "undefined") return null;
  const janela = window as unknown as { BarcodeDetector?: ConstrutorNativo };
  return janela.BarcodeDetector ?? null;
}

/**
 * O leitor depende só da câmera.
 *
 * A decodificação tem reserva em JavaScript, então não é ela que decide se o
 * botão aparece. Sem `getUserMedia` não há imagem nenhuma para ler — aí sim o
 * leitor não tem como existir.
 */
export function suportaLeitorDeQr(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Uma leitura por quadro, seja pelo nativo ou pelo jsQR. */
type Ler = (video: HTMLVideoElement) => Promise<string | null>;

async function montarLeitor(): Promise<Ler> {
  const Nativo = nativoDisponivel();
  if (Nativo) {
    const detector = new Nativo({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }

  const { default: jsQR } = await import("jsqr");
  /*
   * O quadro é copiado para um canvas porque o jsQR trabalha sobre os pixels.
   * O canvas é criado uma vez e reaproveitado: um por quadro faria o coletor
   * de lixo trabalhar quatro vezes por segundo à toa.
   */
  const tela = document.createElement("canvas");
  const pincel = tela.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!pincel || !video.videoWidth) return null;
    /*
     * Reduz o quadro para no máximo 640 de largura antes de decodificar. Numa
     * câmera de celular o quadro cheio é grande demais para ler quatro vezes
     * por segundo, e a imagem da própria câmera começa a engasgar; nessa
     * escala o QR continua legível de sobra.
     */
    const escala = Math.min(1, 640 / video.videoWidth);
    tela.width = Math.round(video.videoWidth * escala);
    tela.height = Math.round(video.videoHeight * escala);
    pincel.drawImage(video, 0, 0, tela.width, tela.height);
    const quadro = pincel.getImageData(0, 0, tela.width, tela.height);
    return jsQR(quadro.data, quadro.width, quadro.height, {
      inversionAttempts: "dontInvert",
    })?.data ?? null;
  };
}

export function LerQr({
  aoLer,
  aoFechar,
}: {
  aoLer: (texto: string) => void;
  aoFechar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  /*
   * A câmera vive no efeito porque tem de ser desligada na saída. Sem o
   * `stop()` de cada trilha, a luz da câmera continua acesa depois de fechar o
   * leitor — e a pessoa fica com a impressão, correta, de que o app não a
   * soltou.
   */
  useEffect(() => {
    let ativo = true;
    let trilhas: MediaStreamTrack[] = [];
    let temporizador: number | undefined;

    void (async () => {
      try {
        const fluxo = await navigator.mediaDevices.getUserMedia({
          // A de trás: é a que aponta para o papel ou para a tela da direção.
          video: { facingMode: "environment" },
        });
        trilhas = fluxo.getTracks();
        if (!ativo) {
          trilhas.forEach((t) => t.stop());
          return;
        }
        const elemento = video.current;
        if (!elemento) return;
        elemento.srcObject = fluxo;
        await elemento.play();

        const ler = await montarLeitor();
        if (!ativo) return;

        /*
         * Quatro leituras por segundo. A cada quadro seria trabalho jogado
         * fora, e num celular modesto isso aparece como travamento da própria
         * imagem da câmera.
         */
        temporizador = window.setInterval(async () => {
          if (!ativo || !video.current) return;
          try {
            const achado = await ler(video.current);
            if (achado && ativo) {
              ativo = false;
              aoLer(achado);
            }
          } catch {
            // Quadro ruim: a próxima leitura tenta de novo.
          }
        }, 250);
      } catch (falha) {
        if (!ativo) return;
        const nome = (falha as { name?: string }).name;
        setErro(
          nome === "NotAllowedError"
            ? "A câmera está bloqueada para este site. Autorize nas permissões do navegador, ou digite o código."
            : "Não foi possível abrir a câmera. Digite o código.",
        );
      }
    })();

    return () => {
      ativo = false;
      if (temporizador) window.clearInterval(temporizador);
      trilhas.forEach((t) => t.stop());
    };
  }, [aoLer]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[14px] leading-5 font-medium text-white">Aponte para o QR code</p>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar o leitor"
          className="grid size-11 place-items-center rounded-[8px] text-white/80 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          className="size-full object-cover"
          aria-label="Imagem da câmera"
        />
        {/* Alvo: mostra onde o código precisa ficar sem cobrir a imagem. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-[62vw] max-w-[280px] rounded-[16px] border-2 border-white/80" />
        </div>
      </div>

      <div className="px-5 pt-4 pb-8">
        {erro ? (
          <Aviso>{erro}</Aviso>
        ) : (
          <p className="text-center text-[13px] leading-5 text-white/70">
            O código é reconhecido sozinho.
          </p>
        )}
        <div className="mt-3">
          <Botao variante="ghost" altura="form" larguraTotal onClick={aoFechar}>
            Digitar o código
          </Botao>
        </div>
      </div>
    </div>
  );
}
