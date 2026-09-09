# Prompt para o Claude Code

Contexto: este repositório é o **Aliança Adonai** (Next.js + React + Tailwind), um sistema de
gestão do teatro da Igreja Aliança. O design foi refeito e está documentado em
`design_handoff_adonaiapp/README.md`, com o protótipo navegável em
`design_handoff_adonaiapp/designs/AdonaiApp.html` (arquivo único, abre offline).

Tarefa:
1. Leia o README inteiro antes de escrever código. Ele traz tokens, tipografia, as 12 telas
   (6 mobile do participante, 6 desktop da direção) e os estados.
2. Instale os tokens: `tokens/adonai-tokens.css` em `app/globals.css` e o tema em
   `tailwind.config.ts` (use `tokens/tailwind.v4.css` se o projeto estiver no Tailwind v4).
   Fontes conforme `tokens/next-fonts.tsx`.
3. Refaça as telas existentes seguindo o design — **não** copie o HTML do protótipo: recrie com
   os componentes e padrões já usados neste repositório (rotas, data layer, form libs).
4. Regras não negociáveis do visual: dark-first; separação por hairline de 1px
   (`--stroke-frame`), nunca sombra em card; cards com raio 16 e inputs/botões raio 8;
   areia (`--brand`) só como acento — preenchimento areia sempre com tinta escura
   (`--brand-ink`); nenhum emoji; ícones Phosphor (peso regular, currentColor).
5. Contraste: texto de 10–12px nunca em `--brand` puro; use `--brand-soft`/`--brand-strong`.
6. Copie os assets de `assets/` para `public/` (ícones do app e favicons).

Comece pelo item mais importante: a tela **Roteiro** do participante, com as falas do
personagem do usuário destacadas (`--speech-bg` + barra `--speech-bar` de 3px + rótulo
`--speech-label`) e o navegador "sua fala N de M" fixo no rodapé.
