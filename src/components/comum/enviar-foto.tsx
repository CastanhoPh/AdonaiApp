"use client";

/**
 * Escolher uma foto do aparelho e enviar.
 *
 * Substitui o campo de link que existia antes. Colar endereço de imagem
 * pressupõe que a pessoa já hospedou o arquivo em algum lugar — e no celular,
 * onde o app é usado, a foto está na galeria ou na câmera, não numa URL.
 *
 * O `<input type="file">` fica escondido e é acionado por um botão: o controle
 * nativo do navegador não aceita estilo e não combina com o resto da interface.
 * `accept="image/*"` faz o Android e o iOS oferecerem câmera e galeria juntos.
 */
import { useRef, useState } from "react";
import { Camera, Trash, UploadSimple } from "@phosphor-icons/react";
import { enviarImagem, problemaComOArquivo, removerImagem } from "@/lib/armazenamento";
import { Aviso, Botao, juntar } from "../ui";

export function EnviarFoto({
  caminho,
  atual,
  ladoMaximo,
  miniatura,
  formato = "circulo",
  rotulo = "Escolher foto",
  onEnviada,
  onRemovida,
  desabilitado = false,
}: {
  /** Onde o arquivo mora no Storage. Ver `lib/armazenamento`. */
  caminho: string;
  /** URL da foto que já está lá, para a prévia. */
  atual?: string;
  ladoMaximo?: number;
  /**
   * Quando presente, sobe também uma cópia pequena no caminho indicado, e
   * `onEnviada` recebe as duas URLs.
   *
   * É o que evita baixar um retrato de 1024 pixels para desenhar um círculo de
   * 28 nas listas. As duas saem do mesmo arquivo escolhido, numa passada só:
   * gerar a pequena depois obrigaria a baixar de volta a grande.
   */
  miniatura?: { caminho: string; lado: number };
  formato?: "circulo" | "retangulo";
  rotulo?: string;
  onEnviada: (url: string, miniUrl?: string) => void | Promise<void>;
  /** Sem isto, não aparece a opção de remover. */
  onRemovida?: () => void | Promise<void>;
  desabilitado?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  /* Prévia local em blob: aparece antes de o envio terminar. */
  const [previa, setPrevia] = useState<string | null>(null);

  async function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Sempre limpa o input: sem isso, escolher o mesmo arquivo de novo depois
    // de um erro não dispara evento nenhum.
    evento.target.value = "";
    if (!arquivo) return;

    const problema = problemaComOArquivo(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }

    /*
     * Prévia local enquanto sobe, para a pessoa ver na hora o que escolheu.
     * Ela precisa sair de cena quando o envio termina: o blob é revogado em
     * seguida, e uma prévia sobrevivente viraria imagem quebrada em vez de dar
     * lugar à foto que acabou de subir.
     */
    const local = URL.createObjectURL(arquivo);
    setErro(null);
    setPrevia(local);
    setProgresso(0);
    setEnviando(true);
    try {
      const { url } = await enviarImagem(caminho, arquivo, {
        ladoMaximo,
        aoProgredir: setProgresso,
      });
      const miniUrl = miniatura
        ? (await enviarImagem(miniatura.caminho, arquivo, { ladoMaximo: miniatura.lado })).url
        : undefined;
      await onEnviada(url, miniUrl);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      setPrevia(null);
      URL.revokeObjectURL(local);
    }
  }

  async function remover() {
    if (!onRemovida) return;
    setErro(null);
    setEnviando(true);
    try {
      await removerImagem(caminho);
      if (miniatura) await removerImagem(miniatura.caminho);
      await onRemovida();
      setPrevia(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover a foto.");
    } finally {
      setEnviando(false);
    }
  }

  const mostrando = previa ?? atual;
  const redondo = formato === "circulo";

  return (
    <div className="space-y-3">
      {/* items-start: em tela estreita os dois botões quebram em duas linhas,
          e centralizar deixava a miniatura flutuando contra elas. */}
      <div className="flex items-start gap-3.5">
        <div
          className={juntar(
            "relative grid shrink-0 place-items-center overflow-hidden border border-stroke-frame bg-surface-raised",
            redondo ? "size-16 rounded-full" : "h-20 w-28 rounded-[10px]",
          )}
        >
          {mostrando ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostrando} alt="" className="size-full object-cover" />
          ) : (
            <Camera size={22} className="text-ink-caption" />
          )}
          {enviando ? (
            <span className="absolute inset-0 grid place-items-center bg-surface-deep/70 text-[11px] font-medium text-ink-heading">
              {progresso > 0 ? `${progresso}%` : "…"}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Botao
              type="button"
              variante="ghost"
              onClick={() => entrada.current?.click()}
              disabled={enviando || desabilitado}
              className="gap-1.5"
            >
              <UploadSimple size={15} />
              {enviando ? "Enviando…" : mostrando ? "Trocar foto" : rotulo}
            </Botao>
            {mostrando && onRemovida ? (
              <Botao
                type="button"
                variante="bare"
                onClick={() => void remover()}
                disabled={enviando || desabilitado}
                className="gap-1.5"
              >
                <Trash size={15} />
                Remover
              </Botao>
            ) : null}
          </div>
          <p className="mt-1.5 text-[12px] leading-[18px] text-ink-caption">
            JPG, PNG ou HEIC do seu aparelho. A imagem é reduzida no envio para gastar menos
            dados.
          </p>
        </div>
      </div>

      {erro ? <Aviso>{erro}</Aviso> : null}

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        onChange={(e) => void escolher(e)}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
