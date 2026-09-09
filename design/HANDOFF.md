# Handoff: AdonaiApp — Aliança Adonai (redesign das telas)

## Overview
Sistema de gestão do teatro da Igreja Aliança. Duas áreas: **app do participante** (mobile-first:
seu personagem, roteiro com as falas destacadas, ensaios, histórico) e **área da direção**
(desktop: painel, pessoas, perfil, elenco, editor de roteiro, ensaios).

Este pacote contém o **redesign visual completo** — paleta, tipografia, densidade e as 12 telas.

## About the Design Files
Os arquivos em `designs/` são **referências de design feitas em HTML** — protótipos que mostram
aparência e comportamento pretendidos, **não** código de produção para copiar. A tarefa é
**recriar estas telas no ambiente já existente do repositório** (Next.js + React + Tailwind),
usando suas rotas, componentes, data layer e bibliotecas de formulário atuais.

- `designs/AdonaiApp.html` — board com as 12 telas (arquivo único, abre offline).
- `designs/AdonaiApp Logo.html` — marca, ícone do app, favicon e variações.

## Fidelity
**High-fidelity.** Cores, tipografia, espaçamentos, raios e estados são finais. Recrie fielmente,
mas com os componentes do repositório. Onde o protótipo mostra dado fictício (nomes, peça
"O Filho Pródigo", trechos de roteiro), ligue ao dado real.

## Design Tokens
Arquivos prontos em `tokens/`: `adonai-tokens.css` (CSS custom properties),
`tailwind.config.ts` (v3), `tailwind.v4.css` (v4), `next-fonts.tsx`.

### Cores
| Papel | Hex | Uso |
| --- | --- | --- |
| surface.base | `#062430` | fundo das telas |
| surface.lower | `#08303F` | header, tab bar, cabeçalho de tabela, sidebar |
| surface.card | `#0A3648` | cards, painéis, linhas de lista |
| surface.raised | `#0B3C51` | hero do personagem, faixas, ícone do app |
| surface.deep | `#041B24` | fundo fora do app (apresentação) |
| stroke.frame | `#1B5470` | hairline de 1px que separa tudo |
| stroke.list | `#103F53` | divisória entre linhas de lista/tabela |
| ink.heading | `#E5E2D0` | títulos, valores, texto sobre destaque |
| ink.body | `#C6D2D6` | corpo de texto, falas de outros personagens |
| ink.caption | `#93A9B3` | rótulos, metadados, eyebrows |
| brand | `#A28F6A` | acento: barra da fala, borda ativa, ícone ativo, preenchimento |
| brand.strong | `#B39E77` | hover + **texto de 11–12px** em areia |
| brand.soft | `#C9BC9B` | **rótulos de 10px** (eyebrow dentro da faixa de fala) |
| brand.ink | `#062430` | tinta sobre preenchimento areia (botão, avatar, tag) |
| brand.secondary | `#3F708C` | tags e informativo |
| state.positive | `#369365` | Confirmado / Ativo |
| state.warning | `#DFA345` | Alterado / Pendente / Em ensaio |
| state.negative | `#C0372B` | Cancelado / erro |

**Contraste (obrigatório):** texto de 10–14px precisa de 4,5:1. Areia pura (#A28F6A) sobre navio
dá ~4,0:1 — por isso texto pequeno usa `brand.strong` ou `brand.soft`; preenchimento areia usa
tinta escura `brand.ink`; tag areia preenchida usa `#79684A` com texto branco (5,4:1).

### Tipografia
- **DM Sans** — interface e leitura. 400 texto longo, 500 UI, 700 títulos.
- **SUSE** — eyebrows e wordmark: UPPERCASE, tracking `0.32em` (rótulo de fala: `0.24em`), 10–12px.
- **Manrope** — números (contadores, datas grandes, "8 peças", KPIs).
- Escala/linha: 11/16 · 12/18 · 13/20 · 14/21 · 15/22–23 · 16/24 · 20/24 · 24/28 · 32/38 · 40/48.

### Espaçamento, raio, elevação
- Espaço: 4 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 32. Gutter de tela mobile: 20px; desktop: 24px.
- Raio: 8 (input, botão, linha do editor) · 16 (card) · 999 (avatar, pill, tag).
- **Sem sombra em card** — separação por hairline de 1px. Sombra só em overlay (menu, toast, dialog).
- Toque mínimo mobile: 48px.
- Movimento: 120–280ms, `cubic-bezier(0.4,0,0.2,1)`. Sem bounce.

### Iconografia
Phosphor Icons, peso Regular, `currentColor`, tamanhos 16/18/20/22/24.
Usados: House, Scroll, CalendarDots, CalendarBlank, User, UsersThree, Certificate, PuzzlePiece,
DiamondsFour, Check, CheckCircle, Plus, PencilSimple, Trash, ArrowsDownUp, ArrowRight,
ArrowUpRight, CaretLeft, CaretRight, MagnifyingGlass, DotsThree, Clock, LockKey. **Sem emoji.**

## Screens / Views

### App do participante (mobile, 402×874 de referência)

**1. Login**
Coluna centralizada, gutter 28px. Logo (mark + wordmark + assinatura "Amo, vivo, sirvo, sou igreja.")
com 232px de largura; eyebrow SUSE 11px areia "ADONAIAPP"; subtítulo 16/24 em ink.body;
campos E-mail e Senha (label 12px caption acima, campo 45px, raio 8, borda stroke.frame,
fundo surface.card); botão primário block 45px (fundo areia, texto brand.ink, 14px/500);
link "Esqueci minha senha" (bare, 14px, ink.heading); rodapé 12px caption.

**2. Início**
Header 64px de topo (status bar) + linha com avatar 40px (fundo areia, iniciais em brand.ink),
"Boa noite," 12px caption + nome 16/24 bold, mark do Aliança 26px opacidade 0.5 à direita;
hairline abaixo.
Conteúdo (gap 16):
- **Card peça atual** (raio 16, surface.card, hairline): eyebrow "PEÇA ATUAL" + Status "Em ensaio"
  (dot warning + label 12px); título 24/28 bold; linha 13/20 caption com data e local; divisória;
  eyebrow "SEU PERSONAGEM"; nome 20/24 bold + tag "Coadjuvante"; descrição 14/21 body;
  botão ghost 37px "Ver meu personagem" com CaretRight.
- **Card próximo ensaio** (surface.raised): bloco de data à esquerda (dia 24px Manrope bold +
  mês 11px uppercase) separado por hairline vertical; eyebrow, "Sábado, 15h00 – 17h00" 15/22 bold,
  local 13/20, Status positive "Confirmado".
- **Dois atalhos** em grid 1fr 1fr, min-height 104: ícone 24 (Roteiro em areia, Histórico em
  ink.body) no topo, título 15 bold + contador 12 caption no pé.
- **Tab bar** (surface.lower, hairline no topo, padding 10/8/30): 4 itens, ícone 22 + label 11/500;
  ativo em `brand.strong`, inativos em `#8FA5AF`.
- **Estado sem personagem**: substitui o card da peça por um card com o mark em watermark
  (opacidade 0.06), título 24/28 "Nos vemos na próxima peça!", texto 14/21 e botão ghost
  "Ver meu histórico".

**3. Meu personagem**
Header com IconButton CaretLeft + título 16 bold. Hero em surface.raised com o mark 120px em
opacidade 0.07 no canto: eyebrow com o nome da peça, nome do personagem 32/38 bold, tags
(tipo do papel + "4 de 7 cenas" + "14 falas"). Corpo: seções "DESCRIÇÃO" (15/23 body) e
"OBSERVAÇÕES DA DIREÇÃO" (bloco com barra areia de 2px à esquerda, padding 14px);
botão primário block "Ver minhas falas no roteiro".

**4. Roteiro atual — tela prioritária**
- Header em surface.lower: voltar, "Roteiro" 15 bold + "peça · versão 3 · 02/09" 11/16 caption,
  IconButtons de busca e menu.
- Abas de ato (underline, ativo em areia).
- Barra de cena: "Cena 3 · O retorno" 13 bold + tag areia preenchida "14 falas suas".
- Lista de falas (gap 14):
  - **indicação de cena**: 12/18 itálico, caption, centralizado;
  - **fala de outro personagem**: nome em SUSE 10px uppercase tracking 0.24em caption + texto 15/23 body;
  - **fala do usuário (destaque)**: fundo `--speech-bg` (areia 18%), barra esquerda 3px areia,
    raio 0 8 8 0, padding 12/14; nome e o selo "SUA FALA" em `--speech-label` (10px uppercase);
    texto 16/24 peso 500 em ink.heading.
- **Navegador fixo** no rodapé (surface.card, hairline no topo): "Sua fala **2** de 14" 12px +
  botão ghost "Anterior" + botão primário "Próxima". Deve rolar para a próxima fala do usuário.

**5. Próximos ensaios**
Título 20/24 + abas "Próximos / Anteriores". Cards (gap 12): bloco de data 48px à esquerda,
horário 15 bold + Status à direita, local/descrição 13/20, avatares 28px empilhados +
"+15 convocados" 12 caption. O ensaio mais próximo recebe **borda areia**. Ensaio alterado exibe
linha extra 12/18 em `state.warning`. Rodapé: data da apresentação, 12px centralizado.

**6. Histórico de peças**
Header com título + total ("8" em Manrope 32 areia + "PEÇAS" 11 uppercase). Lista: coluna de ano
40px (Manrope 13 bold caption) + peça 15 bold + personagem 13 body + tags do tipo do papel;
divisórias em stroke.list.

### Área da direção (desktop, 1280×800 de referência; conteúdo 716px)

Shell comum: **sidebar 248px** (surface.lower, hairline à direita) com mark 28px + "AdonaiApp" 14 bold
+ "TEATRO" 10 uppercase; itens de navegação 40px (ícone 20 + label 13/500, ativo com fundo
`#0E4559` e texto ink.heading); rodapé com avatar do usuário e papel. **Topbar** 20/24px de padding
com título 20/24 bold + subtítulo 13 caption e ações à direita (ghost + primário, 37px).

**7. Painel administrativo** — 4 KPIs em grid (label 12 caption + número Manrope 32/38);
"Personagens sem ator" com borda `state.warning`; dois painéis (Peça atual em linhas
label/valor; Personagens sem ator com botão "Escalar" por linha); faixa do próximo ensaio em
surface.raised com data à esquerda e botão "Abrir ensaio".

**8. Lista de pessoas** — toolbar: título + busca 260px + select "Característica" 190px + botão
"Cadastrar pessoa". Tabela em grid `1.6fr 1.4fr 0.7fr 0.9fr 0.9fr 1fr 0.9fr`, cabeçalho 11px
uppercase em surface.lower; linhas 12px de padding, divisória stroke.list; nome com avatar 28px;
características marcadas com Check 18 em areia, ausentes com em-dash em ink.disabled;
situação com Status (positive/neutral).

**9. Perfil do participante (direção)** — header com avatar 40, nome 24/28, contato 13 caption,
Status "Ativa no grupo", botão "Editar cadastro"; abas Visão geral / Histórico / Observações.
Duas colunas (1fr 1.1fr): esquerda com "Características de atuação" (checkboxes, fill areia com
check em brand.ink) e "Observações da direção" com tag `LockKey` "Só a direção vê" + textarea;
direita com histórico de participações (ano · peça · personagem · tag).
**Regra:** observação interna nunca aparece para o participante.

**10. Montagem do elenco** — duas colunas. Esquerda: personagens da peça (nome + tipo/nº de falas,
pessoa escalada, Status Confirmado/Pendente); o personagem em foco recebe fundo areia 14%.
Direita: candidatos sugeridos pela característica desejada — card com avatar 40, nome, tags de
característica e botão "Escalar" (primário no melhor candidato, ghost nos demais); nota de rodapé
explicando que a participação entra no histórico quando a peça for concluída.

**11. Editor de roteiro** — sidebar com a estrutura (atos, cenas; cena atual em areia) e
"Adicionar cena"; topbar com "Salvar rascunho" (ghost) e "Publicar versão" (primário).
Corpo: linhas de 8px de raio, cada uma com coluna fixa de 150px para o personagem
(select quando em edição, texto 13 bold quando não) + texto da fala + IconButton de excluir/reordenar;
indicação de cena em surface.lower com texto itálico; linha tracejada com "Nova fala" /
"Nova indicação de cena"; faixa final explicando o efeito da publicação + tag "248 falas vinculadas".

**12. Cadastro de ensaio** — duas colunas. Formulário: Data + Peça, Início + Término (grid 1fr 1fr),
Local, Observações (textarea 3 linhas), divisória, "Cancelar" (ghost) + "Criar ensaio" (primário).
Convocação: contador "18 de 32 selecionados", "Selecionar todos" (bare), lista de checkboxes
"Pessoa — personagem", divisória e switch "Avisar os convocados quando eu criar o ensaio"
(dot ativo em verde positive).

## Interactions & Behavior
- Login → identifica o papel e leva para `/` (participante) ou `/admin` (direção).
- Roteiro: "Próxima/Anterior" rolam entre as falas do personagem do usuário (scroll suave, 200ms);
  o contador acompanha; o roteiro completo continua visível.
- Abas de ato trocam o conteúdo sem recarregar; a cena atual fica destacada na estrutura.
- Ensaios ordenados por proximidade; passados vão para a aba "Anteriores".
- Tabela de pessoas: busca por nome (debounce 250ms) + filtros por característica, personagem e nº de peças.
- Elenco: escalar preenche a linha do personagem e muda o Status para Confirmado; um personagem
  aceita apenas uma pessoa por vez.
- Publicar roteiro cria nova versão e é o que os participantes passam a ver.
- Estados: hover = clareia a superfície (`#10506B`); press = translateY 0.5px; foco = anel 2px `#7FA8C8`;
  vazio = mensagem centralizada com o mark em watermark; carregando = skeleton nas superfícies.
- Responsivo: o app do participante é mobile-first e escala para tablet mantendo coluna única de
  no máximo 560px; a área da direção colapsa a sidebar em ícones abaixo de 1100px e empilha as
  duas colunas abaixo de 900px.

## State Management
- `session`: usuário, papel (participante | admin).
- `pecaAtual`: peça marcada como atual (apenas uma).
- `meuPersonagem`: participação do usuário na peça atual (pode ser nulo → estado
  "Nos vemos na próxima peça!").
- `roteiro`: versão publicada, atos → cenas → falas (cada fala vinculada a um personagem);
  derivado: índice das falas do usuário para a navegação.
- `ensaios`: lista com status (Agendado, Confirmado, Alterado, Cancelado, Concluído) e convocados.
- `historico`: participações concluídas (a contagem de peças vem daí, não é campo editável).
- Admin: filtros da tabela, personagem em foco na montagem do elenco, rascunho do roteiro
  (autosave), formulário de ensaio.

## Assets
Em `assets/` (copie para `public/`):
- `adonai-icon-1024/512/192/180.png` — ícone do app (símbolo do Aliança em creme sobre #0B3C51 com fio areia).
- `favicon-32.png`, `favicon-16.png`, `favicon.png`.
- `alianca-logo.png` (marca completa em branco, fundo transparente), `alianca-mark.png`,
  `alianca-mark-cream.png`, `alianca-mark-tan.png`.
Origem: PNG do logotipo enviado pela igreja, recortado e tingido. O logotipo do Aliança é
propriedade da igreja — não altere proporções nem recomponha o símbolo.
Três propostas de marca própria "Aliança Adonai" (SVG) estão em `designs/AdonaiApp Logo.html`,
ainda **pendentes de escolha** — até lá o app usa o símbolo do Aliança.

## Files
- `designs/AdonaiApp.html` — 12 telas (board navegável, offline).
- `designs/AdonaiApp Logo.html` — marca, ícone, favicon, variações e as 3 propostas.
- `tokens/adonai-tokens.css`, `tokens/tailwind.config.ts`, `tokens/tailwind.v4.css`, `tokens/next-fonts.tsx`.
- `CLAUDE_CODE_PROMPT.md` — prompt pronto para colar no Claude Code.
- `assets/` — ícones e marcas.
