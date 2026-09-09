"use client";

/**
 * Componentes visuais do Aliança Adonai, conforme design/HANDOFF.md.
 *
 * Convenções que valem para tudo aqui:
 *  - separação por hairline de 1px (stroke-frame); sombra só em overlay;
 *  - card raio 16, input e botão raio 8, pill 999;
 *  - areia é acento: preenchimento areia leva tinta escura (brand-ink);
 *  - texto de 10-12px em areia usa brand-strong ou brand-soft, nunca areia pura;
 *  - toque mínimo de 48px no mobile.
 */
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { CaretDown, Check, LockKey, X } from "@phosphor-icons/react";
import { iniciais } from "@/lib/format";

export function juntar(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ botões */

type Variante = "primario" | "ghost" | "bare" | "perigo";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-brand text-brand-ink hover:bg-brand-strong",
  ghost: "border border-stroke-frame text-ink-heading hover:bg-surface-hover",
  bare: "text-ink-heading hover:text-brand-strong",
  perigo: "border border-state-negative/40 text-[#e4796c] hover:bg-state-negative/15",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-[8px] text-[14px] font-medium " +
  "transition-colors active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45";

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** 45px é a altura de formulário; 37px a de ação inline. */
  altura?: "form" | "acao";
  larguraTotal?: boolean;
}

export function Botao({
  variante = "primario",
  altura = "acao",
  larguraTotal = false,
  className,
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      className={juntar(
        BASE_BOTAO,
        altura === "form" ? "h-[45px] px-4" : "h-[37px] px-3.5",
        larguraTotal && "w-full",
        VARIANTES[variante],
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = "primario",
  altura = "acao",
  larguraTotal = false,
  className,
  children,
}: {
  href: string;
  variante?: Variante;
  altura?: "form" | "acao";
  larguraTotal?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={juntar(
        BASE_BOTAO,
        altura === "form" ? "h-[45px] px-4" : "h-[37px] px-3.5",
        larguraTotal && "w-full",
        VARIANTES[variante],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Botão só de ícone. No mobile respeita o alvo de 48px. */
export function BotaoIcone({
  rotulo,
  children,
  className,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={juntar(
        "grid size-11 shrink-0 place-items-center rounded-[8px] text-ink-caption transition-colors",
        "hover:bg-surface-hover hover:text-ink-heading sm:size-9",
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

export function LinkIcone({
  href,
  rotulo,
  children,
  className,
}: {
  href: string;
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      title={rotulo}
      className={juntar(
        "grid size-11 shrink-0 place-items-center rounded-[8px] text-ink-caption transition-colors",
        "hover:bg-surface-hover hover:text-ink-heading sm:size-9",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- blocos */

/**
 * O Tailwind resolve classes conflitantes pela ordem no CSS, não pela ordem no
 * atributo: por isso o fundo padrão só entra quando quem chama não define outro.
 */
function definiuFundo(className?: string): boolean {
  return /(^|\s)bg-/.test(className ?? "");
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={juntar(
        "rounded-[16px] border border-stroke-frame",
        !definiuFundo(className) && "bg-surface-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Rótulo em SUSE, caixa alta e tracking largo. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={juntar("eyebrow text-ink-caption", className)}>{children}</p>;
}

export function Divisor({ className }: { className?: string }) {
  return <div className={juntar("h-px bg-stroke-frame", className)} />;
}

export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] leading-6 font-bold text-ink-heading">{titulo}</h1>
        {descricao ? (
          <p className="mt-1 text-[13px] leading-5 text-ink-caption">{descricao}</p>
        ) : null}
      </div>
      {acao ? <div className="flex flex-wrap items-center gap-2">{acao}</div> : null}
    </header>
  );
}

export function TituloSecao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] leading-6 font-bold text-ink-heading">{titulo}</h2>
        {descricao ? (
          <p className="mt-0.5 text-[13px] leading-5 text-ink-caption">{descricao}</p>
        ) : null}
      </div>
      {acao}
    </div>
  );
}

/* ------------------------------------------------------------------- tags */

type TomTag = "neutro" | "areia" | "info" | "positivo" | "aviso" | "negativo";

/*
 * Texto de tag tem 11px, então nenhuma cor de estado entra pura: cada uma ganha
 * uma versão clara que fecha 4,5:1 sobre as superfícies navio.
 */
const TONS_TAG: Record<TomTag, string> = {
  neutro: "bg-surface-raised text-ink-caption border-stroke-frame",
  areia: "bg-brand-tag text-white border-transparent",
  info: "bg-brand-secondary/25 text-[#b9d2e0] border-brand-secondary/45",
  positivo: "bg-state-positive/18 text-[#5fbe8c] border-state-positive/40",
  aviso: "bg-state-warning/18 text-[#e8be72] border-state-warning/40",
  negativo: "bg-state-negative/18 text-[#e4796c] border-state-negative/40",
};

export function Tag({
  tom = "neutro",
  children,
  className,
}: {
  tom?: TomTag;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={juntar(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] leading-4 font-medium whitespace-nowrap",
        TONS_TAG[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

type TomStatus = "positivo" | "aviso" | "negativo" | "neutro" | "info";

const CORES_DOT: Record<TomStatus, string> = {
  positivo: "bg-state-positive",
  aviso: "bg-state-warning",
  negativo: "bg-state-negative",
  neutro: "bg-ink-disabled",
  info: "bg-brand-secondary",
};

/** Ponto colorido + rótulo neutro: a cor fica no dot, o texto mantém contraste. */
export function Status({
  tom,
  children,
  className,
}: {
  tom: TomStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={juntar("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span aria-hidden className={juntar("size-1.5 shrink-0 rounded-full", CORES_DOT[tom])} />
      <span className="text-[12px] leading-[18px] text-ink-body">{children}</span>
    </span>
  );
}

/** Etiqueta de conteúdo restrito à direção. */
export function SeloDirecao({ children = "Só a direção vê" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stroke-frame bg-surface-raised px-2.5 py-[3px] text-[11px] leading-4 text-ink-caption">
      <LockKey size={13} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ formulários */

export function Campo({
  etiqueta,
  dica,
  obrigatorio,
  children,
}: {
  etiqueta: string;
  dica?: string;
  obrigatorio?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] leading-[18px] text-ink-caption">
        {etiqueta}
        {obrigatorio ? <span className="text-[#e4796c]"> *</span> : null}
      </span>
      {children}
      {dica ? (
        <span className="mt-1.5 block text-[11px] leading-4 text-ink-caption">{dica}</span>
      ) : null}
    </label>
  );
}

const CONTROLE =
  "w-full rounded-[8px] border border-stroke-frame bg-surface-card px-3 text-[14px] text-ink-heading " +
  "placeholder:text-ink-disabled transition-colors hover:border-[#2a6d8f] " +
  "focus:border-brand focus:outline-none disabled:opacity-50";

export function Entrada({ className, ...resto }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={juntar(CONTROLE, "h-[45px]", className)} {...resto} />;
}

export function AreaTexto({ className, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={juntar(CONTROLE, "min-h-[86px] resize-y py-3 leading-[21px]", className)}
      {...resto}
    />
  );
}

export function Selecao({
  className,
  children,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={juntar(CONTROLE, "h-[45px] appearance-none pr-9", className)} {...resto}>
        {children}
      </select>
      <CaretDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-caption"
      />
    </div>
  );
}

/** Caixa de seleção: preenchimento areia com o check em tinta escura. */
export function Caixa({
  marcada,
  onClick,
  children,
  descricao,
  desabilitada = false,
}: {
  marcada: boolean;
  onClick: () => void;
  children: ReactNode;
  descricao?: ReactNode;
  desabilitada?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      disabled={desabilitada}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden
        className={juntar(
          "grid size-[18px] shrink-0 place-items-center rounded-[4px] border transition-colors",
          marcada ? "border-brand bg-brand text-brand-ink" : "border-stroke-frame bg-surface-base",
        )}
      >
        {marcada ? <Check size={13} weight="bold" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-[21px] text-ink-heading">{children}</span>
        {descricao ? (
          <span className="block text-[12px] leading-[18px] text-ink-caption">{descricao}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Seleção em pílula, para escolhas curtas de formulário. */
export function Pastilha({
  marcada,
  onClick,
  children,
}: {
  marcada: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcada}
      className={juntar(
        "h-9 rounded-full border px-3 text-[13px] font-medium transition-colors",
        marcada
          ? "border-transparent bg-brand text-brand-ink"
          : "border-stroke-frame text-ink-caption hover:bg-surface-hover hover:text-ink-heading",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- estados */

export function Aviso({
  tom = "negativo",
  children,
}: {
  tom?: "negativo" | "positivo" | "aviso" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  const cores = {
    negativo: "border-state-negative/40 bg-state-negative/12 text-[#e4796c]",
    positivo: "border-state-positive/40 bg-state-positive/12 text-[#5fbe8c]",
    aviso: "border-state-warning/40 bg-state-warning/12 text-[#e8be72]",
    info: "border-brand-secondary/45 bg-brand-secondary/15 text-[#b9d2e0]",
  } as const;
  return (
    <div
      role={tom === "negativo" ? "alert" : "status"}
      className={juntar("rounded-[8px] border px-3 py-2.5 text-[13px] leading-5", cores[tom])}
    >
      {children}
    </div>
  );
}

/** Skeleton nas superfícies, como o handoff pede para carregamento. */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div aria-hidden className={juntar("animate-pulse rounded-[8px] bg-surface-card", className)} />
  );
}

export function Carregando({ texto = "Carregando" }: { texto?: string }) {
  return (
    <div role="status" aria-label={texto} className="esqueleto-atrasado space-y-3 py-2">
      <Esqueleto className="h-[104px] rounded-[16px]" />
      <Esqueleto className="h-[72px] rounded-[16px]" />
      <Esqueleto className="h-[72px] rounded-[16px]" />
    </div>
  );
}

/** Estado vazio: mensagem centralizada com a marca em watermark. */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[16px] border border-stroke-frame bg-surface-card px-5 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/alianca-mark-cream.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-6 w-32 opacity-[0.06]"
      />
      <p className="relative text-[20px] leading-6 font-bold text-ink-heading">{titulo}</p>
      {descricao ? (
        <p className="relative mx-auto mt-2 max-w-md text-[14px] leading-[21px] text-ink-body">
          {descricao}
        </p>
      ) : null}
      {acao ? <div className="relative mt-4 flex justify-center">{acao}</div> : null}
    </section>
  );
}

/* ------------------------------------------------------------- identidade */

export function Avatar({
  nome,
  url,
  tamanho = 40,
}: {
  nome: string;
  url?: string;
  tamanho?: 28 | 40 | 56;
}) {
  const texto = tamanho === 28 ? "text-[11px]" : tamanho === 56 ? "text-[18px]" : "text-[14px]";
  if (url) {
    return (
      // Foto vinda do Storage ou de uma URL informada pela direção.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nome}
        style={{ width: tamanho, height: tamanho }}
        className="shrink-0 rounded-full border border-stroke-frame object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho }}
      className={juntar(
        "grid shrink-0 place-items-center rounded-full bg-brand font-bold text-brand-ink",
        texto,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * Símbolo do Aliança. As três propostas de marca própria "Aliança Adonai"
 * seguem pendentes de escolha; até lá o app usa o símbolo da igreja.
 */
export function MarcaAlianca({
  tamanho = 26,
  className,
  opacidade,
}: {
  tamanho?: number;
  className?: string;
  opacidade?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/alianca-mark-cream.png"
      alt=""
      aria-hidden
      style={{ width: tamanho, opacity: opacidade }}
      className={className}
    />
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  titulo,
  aberto,
  onFechar,
  children,
  rodape,
  largura = "md",
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "md" | "lg";
}) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-deep/70 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onFechar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={juntar(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-[16px] border border-stroke-frame",
          "bg-surface-card shadow-[0_24px_64px_rgba(4,27,36,0.6)] sm:rounded-[16px]",
          largura === "lg" ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stroke-frame px-4 py-3">
          <h2 className="text-[15px] leading-6 font-bold text-ink-heading">{titulo}</h2>
          <BotaoIcone rotulo="Fechar" onClick={onFechar}>
            <X size={18} />
          </BotaoIcone>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {rodape ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-stroke-frame px-4 pt-3 pb-safe sm:pb-3">
            {rodape}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- abas */

const ITEM_DE_ABA =
  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors";
const ABA_APAGADA = "border-transparent text-ink-caption hover:text-ink-heading";

/**
 * Abas com sublinhado; a ativa fica em areia.
 *
 * `atalhos` entram na mesma faixa, à direita das abas, mas são links: levam
 * para outra tela em vez de trocar o conteúdo abaixo. Ficam fora do `tablist`
 * de propósito — aba anuncia que controla um painel ali mesmo, e leitor de tela
 * que anunciasse "aba" para algo que navega estaria mentindo. O ícone é o que
 * separa os dois grupos para quem está olhando.
 */
export function Abas<T extends string>({
  abas,
  ativa,
  onTrocar,
  atalhos,
  className,
}: {
  abas: { chave: T; rotulo: string; contagem?: number }[];
  ativa: T;
  onTrocar: (chave: T) => void;
  atalhos?: { href: string; rotulo: string; contagem?: number; icone?: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={juntar(
        "sem-barra flex gap-5 overflow-x-auto border-b border-stroke-frame",
        className,
      )}
    >
      <div role="tablist" className="flex gap-5">
        {abas.map((aba) => {
          const selecionada = ativa === aba.chave;
          return (
            <button
              key={aba.chave}
              role="tab"
              aria-selected={selecionada}
              onClick={() => onTrocar(aba.chave)}
              className={juntar(
                ITEM_DE_ABA,
                selecionada ? "border-brand text-ink-heading" : ABA_APAGADA,
              )}
            >
              {aba.rotulo}
              {typeof aba.contagem === "number" ? (
                <span className="fonte-num text-[12px] text-ink-caption">{aba.contagem}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {atalhos?.map((atalho) => (
        <Link
          key={atalho.href}
          href={atalho.href}
          className={juntar(ITEM_DE_ABA, ABA_APAGADA)}
        >
          {atalho.icone}
          {atalho.rotulo}
          {typeof atalho.contagem === "number" ? (
            <span className="fonte-num text-[12px] text-ink-caption">{atalho.contagem}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- indicadores */

/** KPI: rótulo 12px caption + número em Manrope 32/38. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  alerta = false,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={juntar(
        "rounded-[16px] border bg-surface-card px-4 py-3.5",
        alerta ? "border-state-warning/60" : "border-stroke-frame",
      )}
    >
      <p className="text-[12px] leading-[18px] text-ink-caption">{rotulo}</p>
      <p
        className={juntar(
          "fonte-num mt-1 text-[32px] leading-[38px] font-bold",
          alerta ? "text-[#e8be72]" : "text-ink-heading",
        )}
      >
        {valor}
      </p>
      {detalhe ? <p className="text-[12px] leading-[18px] text-ink-caption">{detalhe}</p> : null}
    </div>
  );
}

/** Bloco de data à esquerda dos cards de ensaio: dia grande + mês em caixa alta. */
export function BlocoData({
  dia,
  mes,
  largura = 48,
}: {
  dia: string;
  mes: string;
  largura?: number;
}) {
  return (
    <div style={{ width: largura }} className="shrink-0 border-r border-stroke-frame pr-3 text-center">
      <p className="fonte-num text-[24px] leading-7 font-bold text-ink-heading">{dia}</p>
      <p className="text-[11px] leading-4 tracking-wide text-ink-caption uppercase">{mes}</p>
    </div>
  );
}
