import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope, SUSE } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { RegistroServiceWorker } from "@/components/registro-sw";
import "./globals.css";

// DM Sans: interface e leitura. 400 texto longo, 500 UI, 700 títulos.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Manrope: números, contadores e datas grandes.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-manrope",
  display: "swap",
});

// SUSE: eyebrows e wordmark, sempre em caixa alta com tracking largo.
const suse = SUSE({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-suse",
  display: "swap",
});

const DESCRICAO =
  "Seu personagem, o roteiro com as suas falas destacadas e os próximos ensaios do teatro da Igreja Aliança.";

export const metadata: Metadata = {
  // Base absoluta: WhatsApp e Facebook descartam og:image com URL relativa.
  metadataBase: new URL("https://adonaiapp.web.app"),
  title: "Aliança Adonai · Teatro",
  description: DESCRICAO,
  applicationName: "AdonaiApp",
  openGraph: {
    type: "website",
    siteName: "Aliança Adonai",
    title: "Aliança Adonai · Teatro",
    description: DESCRICAO,
    url: "/",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aliança Adonai · Teatro",
    description: DESCRICAO,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AdonaiApp",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/adonai-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#062430",
  width: "device-width",
  initialScale: 1,
  /*
   * Zoom desligado no celular: o app é usado durante o ensaio, com o aparelho
   * na mão, e o pinça-para-ampliar acabava desalinhando o roteiro. A leitura
   * segue ajustável — o roteiro tem controle próprio de tamanho de letra.
   */
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${manrope.variable} ${suse.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface-base font-sans text-ink-body">
        <RegistroServiceWorker />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
