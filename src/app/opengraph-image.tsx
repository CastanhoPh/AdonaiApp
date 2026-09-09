import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Imagem de compartilhamento (WhatsApp, Facebook, Telegram, X).
 *
 * Gerada no build e servida como arquivo estático. Sem ela, os aplicativos
 * escolhem sozinhos alguma imagem da página — e antes disso pegavam o
 * triângulo da Vercel que vinha no esqueleto do Next.js.
 */
// Exportação estática: a imagem é gerada no build, não a cada requisição.
export const dynamic = "force-static";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aliança Adonai — teatro da Igreja Aliança";

/** DM Sans direto do Google Fonts, como no resto do app. */
async function carregarFonte(peso: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=DM+Sans:wght@${peso}&display=swap`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = /src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|woff2?)'\)/.exec(css)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    // Build sem rede: a imagem sai com a fonte padrão em vez de falhar.
    return null;
  }
}

export default async function Imagem() {
  const marca = readFileSync(join(process.cwd(), "public", "alianca-mark-cream.png"));
  const marcaUri = `data:image/png;base64,${marca.toString("base64")}`;

  const [regular, bold] = await Promise.all([carregarFonte(400), carregarFonte(700)]);
  const fonts = [
    ...(regular ? [{ name: "DM Sans", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "DM Sans", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#062430",
          padding: 72,
          fontFamily: fonts.length > 0 ? "DM Sans" : "sans-serif",
          position: "relative",
        }}
      >
        {/* Faixa areia de acento */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 8, background: "#a28f6a" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marcaUri} alt="" width={64} height={64} />
          <div
            style={{
              fontSize: 22,
              letterSpacing: 7,
              textTransform: "uppercase",
              color: "#c9bc9b",
            }}
          >
            Igreja Aliança · Teatro
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 700, color: "#e5e2d0", lineHeight: 1.05 }}>
            Aliança Adonai
          </div>
          <div style={{ fontSize: 38, color: "#c6d2d6", marginTop: 20, lineHeight: 1.3 }}>
            Seu personagem, o roteiro com as suas falas
          </div>
          <div style={{ fontSize: 38, color: "#c6d2d6", lineHeight: 1.3 }}>
            destacadas e os próximos ensaios.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #1b5470",
            paddingTop: 28,
            fontSize: 26,
            color: "#93a9b3",
          }}
        >
          <div style={{ display: "flex" }}>adonaiapp.web.app</div>
          <div style={{ display: "flex", color: "#c9bc9b" }}>Amo, vivo, sirvo, sou igreja.</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
