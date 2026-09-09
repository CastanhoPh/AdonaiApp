import type { ReactNode } from "react";

/**
 * Moldura das telas de login e cadastro: coluna centralizada com gutter de
 * 28px, marca do Aliança em 232px e eyebrow "ADONAIAPP" em areia.
 */
export function MolduraAcesso({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-surface-base px-7 py-10">
      <div className="mx-auto w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/alianca-logo.png"
            alt="Igreja Aliança"
            className="w-[232px] max-w-full"
          />
          <p className="eyebrow mt-7 text-brand-strong">Adonaiapp</p>
          <h1 className="sr-only">AdonaiApp — {titulo}</h1>
          <p className="mt-2.5 text-[16px] leading-6 text-ink-body">{subtitulo}</p>
        </div>

        <div className="mt-8">{children}</div>

        {rodape ? (
          <div className="mt-8 text-center text-[12px] leading-[18px] text-ink-caption">
            {rodape}
          </div>
        ) : null}

        <p className="mt-10 text-center text-[12px] leading-[18px] text-ink-caption">
          Amo, vivo, sirvo, sou igreja.
        </p>
      </div>
    </main>
  );
}
