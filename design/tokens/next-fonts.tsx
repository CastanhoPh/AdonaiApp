// app/layout.tsx — carregamento das fontes (next/font)
import { DM_Sans, Manrope, SUSE } from 'next/font/google';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm-sans' });
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-manrope' });
const suse = SUSE({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-suse' });

export const metadata = {
  title: 'Aliança Adonai · Teatro',
  icons: { icon: '/favicon-32.png', apple: '/adonai-icon-180.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${manrope.variable} ${suse.variable}`}>
      <body className="bg-surface-base font-sans text-ink-body antialiased">{children}</body>
    </html>
  );
}
