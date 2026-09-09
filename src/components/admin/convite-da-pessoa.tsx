"use client";

/**
 * Convite de primeiro acesso, na ficha da pessoa.
 *
 * Aparece só para quem ainda não tem conta ligada — é a fila de trabalho da
 * direção, não uma seção permanente. Gerado o código, a direção mostra o QR na
 * tela, manda o link no WhatsApp ou dita as oito letras: os três chegam no
 * mesmo lugar.
 *
 * O código carrega a ficha, então quem resgata entra já com personagem,
 * histórico e convocações. É o que substitui o vínculo feito a posteriori, em
 * que alguém tinha de adivinhar de quem era um e-mail recém-cadastrado.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowClockwise, Check, Copy, QrCode, Trash } from "@phosphor-icons/react";
import { criarConvite, listarContas, listarConvitesDaPessoa, revogarConvite } from "@/lib/db";
import { dataLonga } from "@/lib/format";
import { useCarregar, useEnvio } from "@/lib/hooks";
import { formatarCodigo, linkDoConvite } from "@/lib/convite";
import type { Convite, Person, UserAccount } from "@/lib/types";
import {
  Aviso,
  Botao,
  BotaoIcone,
  Cartao,
  Esqueleto,
  Modal,
  TituloSecao,
} from "@/components/ui";

export function ConviteDaPessoa({ pessoa, criadoPor }: { pessoa: Person; criadoPor: string }) {
  /* Mesma chave de `AcessoDaPessoa`: as duas querem a mesma lista de contas. */
  const contas = useCarregar<UserAccount[]>("contas-para-ficha", () => listarContas(), []);
  const convites = useCarregar<Convite[]>(
    "convites-da-pessoa",
    () => listarConvitesDaPessoa(pessoa.id),
    [pessoa.id],
  );
  const { enviando, erro, enviar } = useEnvio();
  const [revogando, setRevogando] = useState<Convite | null>(null);

  if (contas.carregando || convites.carregando) {
    return <Esqueleto className="mb-5 h-28 max-w-xl rounded-[16px]" />;
  }

  /*
   * Erro aparece, não desaparece o bloco. Esconder em silêncio já custou caro
   * na fila de vínculos: não havia como distinguir "nada pendente" de "não
   * consegui ler". Com o convite seria pior — a direção concluiria que a
   * pessoa já tem acesso.
   */
  if (contas.erro || convites.erro) {
    return (
      <div className="mb-5 max-w-xl">
        <Aviso>Não foi possível verificar o convite: {contas.erro ?? convites.erro}</Aviso>
      </div>
    );
  }

  // Quem já tem conta não precisa de convite; a etiqueta do topo já diz qual é.
  if ((contas.dados ?? []).some((c) => c.personId === pessoa.id)) return null;

  const agora = new Date().toISOString();
  const emAberto = (convites.dados ?? []).find((c) => !c.usadoEm && c.expiraEm > agora);

  async function gerar() {
    await enviar(async () => {
      await criarConvite(pessoa, criadoPor);
      await convites.recarregar();
    });
  }

  async function revogar() {
    const alvo = revogando;
    if (!alvo) return;
    await enviar(async () => {
      await revogarConvite(alvo.codigo);
      await convites.recarregar();
    });
    setRevogando(null);
  }

  return (
    <Cartao className="mb-5 max-w-xl border-state-warning/40 bg-state-warning/8 px-4 py-4">
      <TituloSecao
        titulo="Primeiro acesso"
        descricao={`${pessoa.nome.split(" ")[0]} ainda não tem conta. Gere um convite: o código já vem ligado a esta ficha, então o histórico e os personagens aparecem no primeiro acesso dela.`}
        acao={
          emAberto ? (
            <>
              <BotaoIcone rotulo="Gerar outro código" onClick={() => void gerar()}>
                <ArrowClockwise size={16} />
              </BotaoIcone>
              <BotaoIcone rotulo="Revogar este convite" onClick={() => setRevogando(emAberto)}>
                <Trash size={16} />
              </BotaoIcone>
            </>
          ) : undefined
        }
      />

      {emAberto ? (
        <ConviteAberto convite={emAberto} />
      ) : (
        <Botao onClick={() => void gerar()} disabled={enviando} className="gap-1.5">
          <QrCode size={16} />
          {enviando ? "Gerando…" : "Gerar convite"}
        </Botao>
      )}

      {erro ? (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      <Modal
        titulo="Revogar este convite?"
        aberto={revogando !== null}
        onFechar={() => setRevogando(null)}
        rodape={
          <>
            <Botao variante="bare" onClick={() => setRevogando(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={() => void revogar()} disabled={enviando}>
              {enviando ? "Revogando…" : "Revogar"}
            </Botao>
          </>
        }
      >
        <p className="text-[14px] leading-[21px] text-ink-body">
          O código {revogando ? formatarCodigo(revogando.codigo) : ""} deixa de funcionar. Quem já
          tiver o QR code ou o link não vai conseguir criar o acesso — gere outro depois.
        </p>
      </Modal>
    </Cartao>
  );
}

/** O código gerado: QR para apontar a câmera, texto para ditar, link para mandar. */
function ConviteAberto({ convite }: { convite: Convite }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const link = linkDoConvite(convite.codigo);

  /*
   * O QR é desenhado no navegador, não buscado de um serviço de imagem: mandar
   * o código para fora só para virar figura o exporia a um terceiro sem
   * necessidade nenhuma.
   */
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const url = await QRCode.toDataURL(link, { margin: 1, width: 320 });
        if (ativo) setQr(url);
      } catch (falha) {
        console.error("Falha ao desenhar o QR code:", falha);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [link]);

  /* Volta a oferecer "Copiar" depois de um instante, senão o botão fica preso em "Copiado". */
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o link está visível para copiar à mão.
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="shrink-0">
        {qr ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qr}
            alt={`QR code do convite de ${convite.personNome}`}
            className="size-[160px] rounded-[8px] bg-white p-1.5"
          />
        ) : (
          <Esqueleto className="size-[160px] rounded-[8px]" />
        )}
      </div>

      <div className="min-w-[220px] flex-1">
        <p className="eyebrow text-ink-caption">Código</p>
        <p className="mt-1 font-mono text-[26px] leading-8 font-bold tracking-[0.14em] text-ink-heading">
          {formatarCodigo(convite.codigo)}
        </p>
        <p className="mt-2 text-[12px] leading-[18px] text-ink-caption">
          Vale até {dataLonga(convite.expiraEm.slice(0, 10))} e serve uma vez só.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Botao variante="ghost" onClick={() => void copiar()} className="gap-1.5">
            {copiado ? <Check size={15} /> : <Copy size={15} />}
            {copiado ? "Link copiado" : "Copiar link"}
          </Botao>
        </div>
        <p className="mt-2 text-[12px] leading-[18px] break-all text-ink-caption">{link}</p>
      </div>
    </div>
  );
}
