"use client";

/**
 * Tutorial de primeiro acesso pelo navegador: apresenta o app em resumo, ensina
 * a instalar na tela de início e pede a permissão de notificações.
 *
 * O passo a passo detalhado de cada tela fica no tour completo
 * (`tour-app.tsx`), que abre na primeira vez que o app roda instalado.
 *
 * Monta apenas depois de a sessão resolver (dentro de `Protegido`), então pode
 * ler `window` já no estado inicial sem risco de divergir da pré-renderização.
 */
import { useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  BellRinging,
  CalendarDots,
  CaretRight,
  Check,
  CheckCircle,
  DeviceMobile,
  DotsThree,
  Export,
  House,
  Scroll,
  TextAa,
  User,
} from "@phosphor-icons/react";
import {
  assinarInstalacao,
  estadoDasNotificacoes,
  guiaVisto,
  instalarApp,
  jaInstalado,
  marcarGuiaVisto,
  plataforma,
  temPromptDeInstalacao,
  type EstadoNotificacoes,
} from "@/lib/instalacao";
import { Botao, Divisor, Eyebrow, MarcaAlianca, Tag, juntar } from "../ui";
import { ControleNotificacoes } from "../comum/notificacoes";

const TOTAL_PASSOS = 4;

export function Tutorial({ uid }: { uid: string }) {
  const [visivel, setVisivel] = useState(() => !guiaVisto("tutorial", uid));
  const [passo, setPasso] = useState(0);
  const [instalado, setInstalado] = useState(() => jaInstalado());
  const [notificacoes, setNotificacoes] = useState<EstadoNotificacoes>(() =>
    estadoDasNotificacoes(),
  );

  // O navegador pode oferecer o diálogo nativo a qualquer momento.
  const temPrompt = useSyncExternalStore(assinarInstalacao, temPromptDeInstalacao, () => false);

  const sistema = plataforma();

  function encerrar() {
    marcarGuiaVisto("tutorial", uid);
    setVisivel(false);
  }

  async function instalar() {
    const resultado = await instalarApp();
    if (resultado === "aceita") setInstalado(true);
  }

  if (!visivel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-deep/80 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Primeiros passos no AdonaiApp"
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[16px] border border-stroke-frame bg-surface-card shadow-[0_24px_64px_rgba(4,27,36,0.6)] sm:rounded-[16px]"
      >
        <MarcaAlianca
          tamanho={140}
          opacidade={0.05}
          className="pointer-events-none absolute -top-8 -right-10"
        />

        <div className="relative flex-1 overflow-y-auto px-5 pt-6 pb-2">
          {passo === 0 ? <PassoBoasVindas /> : null}
          {passo === 1 ? (
            <PassoInstalar
              instalado={instalado}
              temPrompt={temPrompt}
              sistema={sistema}
              onInstalar={() => void instalar()}
            />
          ) : null}
          {passo === 2 ? <PassoNotificacoes onMudar={setNotificacoes} /> : null}
          {passo === 3 ? (
            <PassoFinal instalado={instalado} notificacoes={notificacoes} />
          ) : null}
        </div>

        <div className="relative border-t border-stroke-frame px-5 pt-3 pb-safe sm:pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: TOTAL_PASSOS }, (_, i) => (
                <span
                  key={i}
                  className={juntar(
                    "h-1.5 rounded-full transition-all",
                    i === passo ? "w-5 bg-brand" : "w-1.5 bg-stroke-frame",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {passo < TOTAL_PASSOS - 1 ? (
                <>
                  <Botao variante="bare" onClick={encerrar}>
                    Pular
                  </Botao>
                  <Botao onClick={() => setPasso((p) => p + 1)} className="gap-1.5">
                    Continuar
                    <ArrowRight size={15} />
                  </Botao>
                </>
              ) : (
                <Botao onClick={encerrar} className="gap-1.5">
                  <Check size={15} />
                  Começar a usar
                </Botao>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ passos */

function Titulo({ eyebrow, titulo, texto }: { eyebrow: string; titulo: string; texto: string }) {
  return (
    <div className="mb-5">
      <Eyebrow className="text-brand-strong">{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-[24px] leading-7 font-bold text-ink-heading">{titulo}</h2>
      <p className="mt-2 text-[14px] leading-[21px] text-ink-body">{texto}</p>
    </div>
  );
}

function Item({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-stroke-list py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-brand">{icone}</span>
      <span className="min-w-0">
        <span className="block text-[14px] leading-[21px] font-medium text-ink-heading">
          {titulo}
        </span>
        <span className="block text-[13px] leading-5 text-ink-caption">{texto}</span>
      </span>
    </li>
  );
}

function PassoBoasVindas() {
  return (
    <>
      <Titulo
        eyebrow="Primeiros passos"
        titulo="Bem-vindo ao AdonaiApp"
        texto="Aqui ficam seu personagem, o roteiro com as suas falas destacadas e os próximos ensaios do teatro."
      />
      <ul>
        <Item
          icone={<House size={20} />}
          titulo="Início"
          texto="A peça atual, seu personagem e o próximo ensaio. É por aqui que você chega ao seu personagem e ao histórico."
        />
        <Item
          icone={<Scroll size={20} />}
          titulo="Roteiro"
          texto="O roteiro completo, com as suas falas em destaque e um navegador para pular de uma para a outra."
        />
        <Item
          icone={<CalendarDots size={20} />}
          titulo="Ensaios"
          texto="Data, horário, local e quem foi convocado."
        />
        <Item
          icone={<User size={20} />}
          titulo="Perfil"
          texto="Seus dados, suas características e as peças que você já fez."
        />
      </ul>
      <p className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-ink-caption">
        <TextAa size={18} className="mt-px shrink-0" />
        No roteiro dá para aumentar a letra quando a luz do ensaio estiver baixa.
      </p>
    </>
  );
}

function PassoInstalar({
  instalado,
  temPrompt,
  sistema,
  onInstalar,
}: {
  instalado: boolean;
  temPrompt: boolean;
  sistema: "ios" | "android" | "outro";
  onInstalar: () => void;
}) {
  if (instalado) {
    return (
      <>
        <Titulo
          eyebrow="Tela de início"
          titulo="Já está instalado"
          texto="Você está usando o AdonaiApp como aplicativo. Ele abre em tela cheia, sem a barra do navegador."
        />
        <Tag tom="positivo">
          <CheckCircle size={13} />
          Instalado neste aparelho
        </Tag>
      </>
    );
  }

  return (
    <>
      <Titulo
        eyebrow="Tela de início"
        titulo="Coloque na tela de início"
        texto="Assim o AdonaiApp fica com ícone próprio, abre em tela cheia e você não precisa lembrar do endereço. Na primeira vez que abrir por ele, um tour completo apresenta cada tela."
      />

      {temPrompt ? (
        <>
          <Botao onClick={onInstalar} altura="form" larguraTotal className="gap-1.5">
            <DeviceMobile size={17} />
            Instalar agora
          </Botao>
          <p className="mt-3 text-[12px] leading-[18px] text-ink-caption">
            O navegador vai pedir a confirmação.
          </p>
        </>
      ) : sistema === "ios" ? (
        <ol className="space-y-0">
          <Passo numero={1} icone={<Export size={18} />}>
            No Safari, toque no botão <strong className="text-ink-heading">Compartilhar</strong> —
            o quadrado com a flecha para cima, na barra de baixo.
          </Passo>
          <Passo numero={2} icone={<CaretRight size={18} />}>
            Role a lista e toque em{" "}
            <strong className="text-ink-heading">Adicionar à Tela de Início</strong>.
          </Passo>
          <Passo numero={3} icone={<Check size={18} />}>
            Confirme em <strong className="text-ink-heading">Adicionar</strong>. O ícone do
            AdonaiApp aparece junto dos seus outros apps.
          </Passo>
        </ol>
      ) : sistema === "android" ? (
        <ol className="space-y-0">
          <Passo numero={1} icone={<DotsThree size={18} />}>
            Toque no menu de <strong className="text-ink-heading">três pontos</strong>, no canto do
            navegador.
          </Passo>
          <Passo numero={2} icone={<DeviceMobile size={18} />}>
            Escolha <strong className="text-ink-heading">Instalar aplicativo</strong> ou{" "}
            <strong className="text-ink-heading">Adicionar à tela inicial</strong>.
          </Passo>
          <Passo numero={3} icone={<Check size={18} />}>
            Confirme. O ícone do AdonaiApp vai para a sua tela de início.
          </Passo>
        </ol>
      ) : (
        <ol className="space-y-0">
          <Passo numero={1} icone={<DeviceMobile size={18} />}>
            No Chrome ou Edge, clique no ícone de{" "}
            <strong className="text-ink-heading">instalar</strong> na barra de endereço, à direita.
          </Passo>
          <Passo numero={2} icone={<Check size={18} />}>
            Confirme em <strong className="text-ink-heading">Instalar</strong>.
          </Passo>
          <Passo numero={3} icone={<CaretRight size={18} />}>
            No celular o passo a passo é parecido, pelo menu do navegador.
          </Passo>
        </ol>
      )}
    </>
  );
}

function Passo({
  numero,
  icone,
  children,
}: {
  numero: number;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-stroke-list py-3 last:border-0">
      <span className="fonte-num grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-brand-ink">
        {numero}
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-5 text-ink-body">{children}</span>
      <span className="mt-0.5 shrink-0 text-ink-caption">{icone}</span>
    </li>
  );
}

function PassoNotificacoes({ onMudar }: { onMudar: (estado: EstadoNotificacoes) => void }) {
  return (
    <>
      <Titulo
        eyebrow="Avisos"
        titulo="Autorize os avisos de ensaio"
        texto="Com a permissão dada, a direção poderá te avisar quando um ensaio for marcado, alterado ou cancelado."
      />

      <ControleNotificacoes larguraTotal onMudar={onMudar} />

      <Divisor className="my-4" />
      <p className="text-[12px] leading-[18px] text-ink-caption">
        O envio dos avisos ainda vai ser ligado pela direção — a permissão fica guardada até lá.
        Você pode autorizar depois pela tela de Perfil. Nenhuma outra autorização é pedida: o app
        não usa câmera, microfone nem localização.
      </p>
    </>
  );
}

function PassoFinal({
  instalado,
  notificacoes,
}: {
  instalado: boolean;
  notificacoes: EstadoNotificacoes;
}) {
  return (
    <>
      <Titulo
        eyebrow="Tudo pronto"
        titulo="Bom ensaio!"
        texto="Você pode rever estes passos pela tela de Perfil, e eles voltam a aparecer se você entrar em outro aparelho."
      />
      <ul>
        <Item
          icone={instalado ? <CheckCircle size={20} /> : <DeviceMobile size={20} />}
          titulo={instalado ? "App na tela de início" : "Instalação pendente"}
          texto={
            instalado
              ? "O AdonaiApp abre direto do ícone."
              : "Você pode instalar depois, pelo menu do navegador."
          }
        />
        <Item
          icone={notificacoes === "granted" ? <CheckCircle size={20} /> : <BellRinging size={20} />}
          titulo={notificacoes === "granted" ? "Avisos autorizados" : "Avisos não autorizados"}
          texto={
            notificacoes === "granted"
              ? "A direção poderá te avisar sobre os ensaios."
              : "Sem problema — dá para autorizar depois no Perfil."
          }
        />
      </ul>
    </>
  );
}
