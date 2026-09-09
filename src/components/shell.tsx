"use client";

/**
 * Proteção de rotas e as duas estruturas de navegação do handoff:
 * tab bar de 4 itens no app do participante (mobile-first, coluna de até
 * 560px) e sidebar de 248px na área da direção (desktop, colapsando em
 * ícones abaixo de 1100px).
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellRinging,
  CalendarDots,
  CaretLeft,
  CaretRight,
  DiamondsFour,
  House,
  PuzzlePiece,
  Scroll,
  User,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { firebaseConfigurado } from "@/lib/firebase";
import type { Person } from "@/lib/types";
import { nomeCurto } from "@/lib/format";
import {
  adiarCadastro,
  cadastroAdiado,
  estadoDasNotificacoes,
  guiaVisto,
  jaInstalado,
  limparAdiamentoDoCadastro,
} from "@/lib/instalacao";
import { registrarAparelho } from "@/lib/notificacoes";
import { Tutorial } from "./acesso/tutorial";
import { TourApp } from "./acesso/tour-app";
import { CadastroInicial } from "./acesso/cadastro-pessoa";
import { PreCarregarDirecao } from "./admin/pre-carregar";
import {
  Avatar,
  Aviso,
  Botao,
  BotaoIcone,
  Carregando,
  Divisor,
  MarcaAlianca,
  Modal,
  Tag,
  Vazio,
  juntar,
} from "./ui";

/** Tela exibida quando o `.env.local` ainda não tem as chaves do Firebase. */
function FirebaseAusente() {
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <Vazio
        titulo="Firebase não configurado"
        descricao="Copie o arquivo .env.local.example para .env.local e preencha as chaves do projeto Firebase. As instruções completas estão no README."
      />
    </main>
  );
}

export function Protegido({
  apenasAdmin = false,
  children,
}: {
  apenasAdmin?: boolean;
  children: ReactNode;
}) {
  const { carregando, usuario, ehAdmin, pessoa } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !usuario && firebaseConfigurado) router.replace("/login");
  }, [carregando, usuario, router]);

  if (!firebaseConfigurado) return <FirebaseAusente />;

  if (carregando || !usuario) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-5 py-8">
        <Carregando texto="Abrindo o AdonaiApp" />
      </main>
    );
  }

  if (apenasAdmin && !ehAdmin) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Vazio
          titulo="Área restrita à direção"
          descricao="Somente administradores acessam esta parte do aplicativo."
          acao={
            <Link href="/inicio" className="text-[14px] font-medium text-brand-strong underline">
              Voltar para o início
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <>
      <RegistroAvisos uid={usuario.uid} />
      <PrimeiroAcesso
        uid={usuario.uid}
        ehAdmin={ehAdmin}
        pessoa={pessoa}
        naAreaDaDirecao={apenasAdmin}
      />
      {children}
    </>
  );
}

/**
 * Cadastro antes dos guias: sem nome, contato e responsável não há como escalar
 * ninguém, então o formulário tem prioridade sobre o tutorial.
 *
 * Ele abre só na área do participante. Administrar o teatro não depende do
 * cadastro pessoal de quem administra, e abrir na direção prendia a navegação —
 * sem sidebar por baixo, não havia como voltar para a outra visão. Na área da
 * direção entra um aviso discreto, em `ShellAdmin`.
 *
 * E não é mais uma parede: enquanto as únicas saídas eram responder ou sair da
 * conta, quem tocava numa aba não via reação nenhuma e concluía que o app tinha
 * travado. Quem adia passa a ser cobrado por `AvisoCadastro`, no topo de todas
 * as telas.
 *
 * Contas ainda sem cadastro na direção (`pessoa` nulo) caem direto nos guias —
 * a tela de Início já explica que falta o registro.
 */
function PrimeiroAcesso({
  uid,
  ehAdmin,
  pessoa,
  naAreaDaDirecao,
}: {
  uid: string;
  ehAdmin: boolean;
  pessoa: Person | null;
  naAreaDaDirecao: boolean;
}) {
  // Fecha na hora, sem esperar o recarregamento da sessão devolver a pessoa.
  const [concluido, setConcluido] = useState(false);
  // Adiado neste aparelho: abre o app e cobra pela tarja, não pelo modal.
  const [adiado, setAdiado] = useState(() => cadastroAdiado(uid));

  if (!naAreaDaDirecao && pessoa && !pessoa.cadastroCompletoEm && !concluido && !adiado) {
    return (
      <CadastroInicial
        pessoa={pessoa}
        onConcluido={() => {
          limparAdiamentoDoCadastro(uid);
          setConcluido(true);
        }}
        onDepois={() => {
          adiarCadastro(uid);
          setAdiado(true);
        }}
      />
    );
  }
  return <Guias uid={uid} ehAdmin={ehAdmin} />;
}

/**
 * Tarja de cobrança do cadastro, no topo do app do participante.
 *
 * Substitui o bloqueio: o formulário pode ser adiado, mas a direção precisa dos
 * dados, então o pedido fica visível em todas as telas até ser respondido.
 */
function AvisoCadastro() {
  const { pessoa } = useAuth();
  const caminho = usePathname();

  // No Perfil o próprio formulário está à mão; a tarja ali só repetiria.
  if (!pessoa || pessoa.cadastroCompletoEm || caminho === "/perfil") return null;

  return (
    <div className="border-b border-stroke-frame bg-surface-lower sem-impressao">
      <div className="mx-auto flex w-full max-w-[560px] items-center gap-3 px-5 py-2.5">
        <span className="shrink-0 text-brand">
          <WarningCircle size={17} />
        </span>
        <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-ink-body">
          Falta completar seu cadastro para a direção poder te escalar.
        </p>
        <Link
          href="/perfil"
          className="shrink-0 text-[12px] leading-[18px] font-medium text-brand-strong hover:underline"
        >
          Completar
        </Link>
      </div>
    </div>
  );
}

/**
 * Reconfirma o token de push a cada abertura do app. Os tokens do FCM giram, e
 * um token velho na conta significa aviso que não chega.
 */
function RegistroAvisos({ uid }: { uid: string }) {
  useEffect(() => {
    if (estadoDasNotificacoes() === "granted") void registrarAparelho(uid);
  }, [uid]);
  return null;
}

/**
 * Escolhe qual guia abrir. Rodando instalado na tela de início, entra o tour
 * completo; no navegador, o tutorial curto que ensina a instalar. Cada um se
 * esconde sozinho depois de visto neste aparelho.
 */
function Guias({ uid, ehAdmin }: { uid: string; ehAdmin: boolean }) {
  const [tourAberto, setTourAberto] = useState(
    () => jaInstalado() && !guiaVisto("tour", uid),
  );

  if (tourAberto) {
    return <TourApp uid={uid} ehAdmin={ehAdmin} onFechar={() => setTourAberto(false)} />;
  }
  return <Tutorial uid={uid} />;
}

/* --------------------------------------------------------- participante */

interface ItemNav {
  href: string;
  rotulo: string;
  Icone: typeof House;
}

const NAV_PARTICIPANTE: ItemNav[] = [
  { href: "/inicio", rotulo: "Início", Icone: House },
  { href: "/roteiro", rotulo: "Roteiro", Icone: Scroll },
  { href: "/ensaios", rotulo: "Ensaios", Icone: CalendarDots },
  { href: "/perfil", rotulo: "Perfil", Icone: User },
];

const NAV_ADMIN: ItemNav[] = [
  { href: "/admin", rotulo: "Painel", Icone: DiamondsFour },
  { href: "/admin/pessoas", rotulo: "Pessoas", Icone: UsersThree },
  { href: "/admin/pecas", rotulo: "Peças", Icone: PuzzlePiece },
  { href: "/admin/ensaios", rotulo: "Ensaios", Icone: CalendarDots },
  { href: "/admin/avisos", rotulo: "Avisos", Icone: BellRinging },
];

function ativo(caminho: string, href: string): boolean {
  if (href === "/admin") return caminho === "/admin";
  if (href === "/inicio") return caminho === "/inicio" || caminho === "/personagem";
  return caminho === href || caminho.startsWith(`${href}/`);
}

/** Tab bar: ícone 22 + label 11, ativo em brand-strong, alvo de 48px. */
function TabBar() {
  const caminho = usePathname();
  return (
    <nav className="sticky bottom-0 z-30 border-t border-stroke-frame bg-surface-lower sem-impressao">
      <ul className="mx-auto flex w-full max-w-[560px] px-2 pt-2.5 pb-2 nav-safe">
        {NAV_PARTICIPANTE.map(({ href, rotulo, Icone }) => {
          const selecionado = ativo(caminho, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={selecionado ? "page" : undefined}
                className={juntar(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-medium transition-colors",
                  selecionado ? "text-brand-strong" : "text-ink-tab hover:text-ink-heading",
                )}
              >
                <Icone size={22} />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ShellParticipante({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-base">
      <AvisoCadastro />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-5 pt-4 pb-6">{children}</main>
      <TabBar />
    </div>
  );
}

/**
 * Cabeçalho do Início: avatar 40 + saudação + símbolo do Aliança à direita,
 * com hairline abaixo.
 */
/**
 * Moldura do topo, compartilhada por todas as telas do participante.
 *
 * As quatro abas são do mesmo nível, então o topo tem de ser o mesmo. Antes
 * cada uma trazia o seu: Início com saudação e fio, Roteiro com seta de voltar
 * e título de 15px, Ensaios e Perfil só com título de 20px e sem fio nenhum.
 * Fora a inconsistência, as alturas diferentes faziam o conteúdo pular a cada
 * troca de aba.
 *
 * A altura mínima é a do topo mais alto: duas linhas de texto (18 + 24), os 16
 * de respiro e o próprio fio de 1px — 59 no total, porque a caixa inclui a
 * borda. É ela que mantém o fio na mesma linha nas telas de uma linha só, que
 * sem isso ficariam 3px mais curtas.
 *
 * As subtelas (Meu personagem, Histórico) saem 2px mais altas: o botão de
 * voltar tem 44px de alvo de toque, que é o mínimo para não errar o dedo, e
 * encurtá-lo para casar a altura sairia mais caro do que os 2px.
 */
function MolduraTopo({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <header
      className={juntar(
        "-mx-5 mb-4 flex min-h-[59px] items-center gap-3 border-b border-stroke-frame px-5 pb-4 sem-impressao",
        className,
      )}
    >
      {children}
    </header>
  );
}

export function TopoInicio({ saudacao, nome }: { saudacao: string; nome: string }) {
  const { pessoa, conta } = useAuth();
  return (
    <MolduraTopo>
      <Avatar nome={nome} url={pessoa?.fotoUrl} tamanho={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-[18px] text-ink-caption">{saudacao},</p>
        <p className="truncate text-[16px] leading-6 font-bold text-ink-heading">
          {nomeCurto(pessoa?.nome ?? conta?.nome ?? nome)}
        </p>
      </div>
      <MarcaAlianca tamanho={26} opacidade={0.5} />
    </MolduraTopo>
  );
}

/**
 * Topo das outras três abas (Roteiro, Ensaios, Perfil).
 *
 * Sem seta de voltar de propósito: são destinos da tab bar, não subtelas, e
 * "voltar" num item de menu não tem para onde ir. A marca do Aliança ocupa a
 * direita quando a tela não tem ações próprias, para as quatro abas lerem como
 * a mesma barra.
 */
export function TopoAba({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
}) {
  return (
    <MolduraTopo>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] leading-6 font-bold text-ink-heading">{titulo}</h1>
        {subtitulo ? (
          <p className="truncate text-[12px] leading-[18px] text-ink-caption">{subtitulo}</p>
        ) : null}
      </div>
      {acoes ? (
        <div className="flex shrink-0 items-center gap-1">{acoes}</div>
      ) : (
        <MarcaAlianca tamanho={26} opacidade={0.5} />
      )}
    </MolduraTopo>
  );
}

/** Cabeçalho interno: voltar + título, com ações opcionais à direita. */
export function TopoParticipante({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
  acoes?: ReactNode;
}) {
  const router = useRouter();
  return (
    <MolduraTopo className="gap-1 px-2">
      {voltarPara ? (
        <Link
          href={voltarPara}
          aria-label="Voltar"
          className="grid size-11 shrink-0 place-items-center rounded-[8px] text-ink-caption hover:bg-surface-hover hover:text-ink-heading"
        >
          <CaretLeft size={20} />
        </Link>
      ) : (
        <BotaoIcone rotulo="Voltar" onClick={() => router.back()}>
          <CaretLeft size={20} />
        </BotaoIcone>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] leading-6 font-bold text-ink-heading">{titulo}</h1>
        {subtitulo ? (
          <p className="truncate text-[12px] leading-[18px] text-ink-caption">{subtitulo}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex shrink-0 items-center gap-1">{acoes}</div> : null}
    </MolduraTopo>
  );
}

/* ---------------------------------------------------------------- direção */

/**
 * Menu da conta da direção: mostra quem está logado, troca para a visão de
 * participante e sai. Aberto pelo avatar — no celular era justamente o que
 * faltava, porque os atalhos do rodapé da sidebar ficavam escondidos.
 */
function MenuConta({
  aberto,
  onFechar,
  nome,
  email,
  foto,
}: {
  aberto: boolean;
  onFechar: () => void;
  nome: string;
  email: string;
  foto?: string;
}) {
  const { sair } = useAuth();
  return (
    <Modal titulo="Sua conta" aberto={aberto} onFechar={onFechar}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar nome={nome} url={foto} tamanho={40} />
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-[22px] font-bold text-ink-heading">{nome}</p>
          <p className="truncate text-[12px] leading-[18px] text-ink-caption">{email}</p>
        </div>
        <Tag tom="areia" className="ml-auto shrink-0">
          Direção
        </Tag>
      </div>

      <Divisor />

      <Link
        href="/inicio"
        onClick={onFechar}
        className="-mx-2 flex items-center justify-between gap-3 rounded-[8px] px-2 py-3.5 text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          Minha área de participante
          <span className="block text-[12px] leading-[18px] text-ink-caption">
            Ver o app como o elenco vê: seu personagem, roteiro e ensaios.
          </span>
        </span>
        <CaretRight size={15} className="shrink-0 text-ink-caption" />
      </Link>

      <Divisor />

      <button
        type="button"
        onClick={() => void sair()}
        className="-mx-2 w-full rounded-[8px] px-2 py-3.5 text-left text-[14px] font-medium text-ink-heading transition-colors hover:bg-surface-hover"
      >
        Sair da conta
      </button>
    </Modal>
  );
}

/**
 * Estrutura da direção em três larguras:
 *  - a partir de 1100px, a sidebar de 248px com os rótulos;
 *  - entre 900 e 1100px, a mesma sidebar colapsada em ícones, como no handoff;
 *  - abaixo de 900px, sem sidebar: barra no topo com a conta e tab bar embaixo,
 *    porque um trilho de 68px come largura demais na tela de um celular.
 */
export function ShellAdmin({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const { conta, pessoa } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  const nome = nomeCurto(pessoa?.nome ?? conta?.nome ?? "");
  const email = conta?.email ?? "";
  const foto = pessoa?.fotoUrl;

  return (
    <div className="flex min-h-dvh bg-surface-base">
      <PreCarregarDirecao />
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-stroke-frame bg-surface-lower min-[900px]:flex min-[900px]:max-[1099px]:w-[68px] sem-impressao">
        <div className="flex items-center gap-2.5 px-4 py-4 min-[900px]:max-[1099px]:justify-center min-[900px]:max-[1099px]:px-0">
          <MarcaAlianca tamanho={28} />
          <div className="leading-tight min-[900px]:max-[1099px]:hidden">
            <p className="text-[14px] font-bold text-ink-heading">AdonaiApp</p>
            <p className="eyebrow text-ink-caption">Teatro</p>
          </div>
        </div>

        <nav className="flex-1 px-3 min-[900px]:max-[1099px]:px-2">
          <ul className="space-y-1">
            {NAV_ADMIN.map(({ href, rotulo, Icone }) => {
              const selecionado = ativo(caminho, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={selecionado ? "page" : undefined}
                    title={rotulo}
                    className={juntar(
                      "flex h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] font-medium transition-colors",
                      "min-[900px]:max-[1099px]:justify-center min-[900px]:max-[1099px]:px-0",
                      selecionado
                        ? "bg-surface-active text-ink-heading"
                        : "text-ink-caption hover:bg-surface-hover hover:text-ink-heading",
                    )}
                  >
                    <Icone size={20} />
                    <span className="min-[900px]:max-[1099px]:hidden">{rotulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-stroke-frame p-3">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            title="Sua conta"
            className="flex w-full items-center gap-2.5 rounded-[8px] p-1 text-left transition-colors hover:bg-surface-hover min-[900px]:max-[1099px]:justify-center"
          >
            <Avatar nome={nome} url={foto} tamanho={28} />
            <span className="min-w-0 flex-1 leading-tight min-[900px]:max-[1099px]:hidden">
              <span className="block truncate text-[13px] font-medium text-ink-heading">
                {nome}
              </span>
              <span className="block text-[11px] text-ink-caption">Direção · trocar de visão</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior do celular: marca à esquerda, conta à direita. */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stroke-frame bg-surface-lower px-4 py-2 min-[900px]:hidden sem-impressao">
          <span className="flex items-center gap-2.5">
            <MarcaAlianca tamanho={26} />
            <span className="leading-tight">
              <span className="block text-[14px] font-bold text-ink-heading">AdonaiApp</span>
              <span className="eyebrow block text-ink-caption">Direção</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Sua conta"
            className="grid size-11 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-surface-hover"
          >
            <Avatar nome={nome} url={foto} tamanho={28} />
          </button>
        </header>

        <div className="min-w-0 flex-1">
          {pessoa && !pessoa.cadastroCompletoEm ? (
            <div className="border-b border-state-warning/40 bg-state-warning/12 px-6 py-2.5 max-sm:px-4 sem-impressao">
              <p className="text-[13px] leading-5 text-[#e8be72]">
                Seu cadastro de participante está pendente.{" "}
                <Link href="/perfil" className="font-medium underline">
                  Preencher agora
                </Link>{" "}
                — leva um minuto e não atrapalha a administração.
              </p>
            </div>
          ) : null}
          {children}
        </div>

        {/* Tab bar do celular, com os cinco destinos da direção. */}
        <nav className="sticky bottom-0 z-30 border-t border-stroke-frame bg-surface-lower min-[900px]:hidden nav-safe sem-impressao">
          <ul className="flex px-1 pt-2 pb-1">
            {NAV_ADMIN.map(({ href, rotulo, Icone }) => {
              const selecionado = ativo(caminho, href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={selecionado ? "page" : undefined}
                    className={juntar(
                      "flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] px-0.5 text-[10px] leading-3 font-medium transition-colors",
                      selecionado ? "text-brand-strong" : "text-ink-tab hover:text-ink-heading",
                    )}
                  >
                    <Icone size={21} />
                    {rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <MenuConta
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
        nome={nome}
        email={email}
        foto={foto}
      />
    </div>
  );
}

/** Topbar da direção: título + subtítulo à esquerda, ações à direita. */
export function TopoAdmin({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke-frame px-6 py-5 max-sm:px-4">
      <div className="min-w-0">
        <h1 className="text-[20px] leading-6 font-bold text-ink-heading">{titulo}</h1>
        {subtitulo ? (
          <p className="mt-1 text-[13px] leading-5 text-ink-caption">{subtitulo}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

/** Corpo das páginas da direção, com o gutter de 24px do handoff. */
export function CorpoAdmin({ children }: { children: ReactNode }) {
  return <div className="px-6 py-6 pb-safe max-sm:px-4">{children}</div>;
}

/** Migalha de volta usada nas telas internas da direção. */
export function VoltarPara({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-caption hover:text-ink-heading"
    >
      <CaretLeft size={14} />
      {rotulo}
    </Link>
  );
}

/** Estado de erro padrão das telas, com opção de tentar novamente. */
export function ErroCarregamento({
  erro,
  onTentarNovamente,
}: {
  erro: string;
  onTentarNovamente: () => void;
}) {
  return (
    <div className="space-y-3">
      <Aviso>{erro}</Aviso>
      <Botao variante="ghost" onClick={onTentarNovamente}>
        Tentar novamente
      </Botao>
    </div>
  );
}
