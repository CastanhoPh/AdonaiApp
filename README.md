# AdonaiApp

Aplicativo web do teatro da **Igreja Aliança**: centraliza integrantes, peças,
personagens, elenco, roteiro e ensaios em um só lugar. A interface é pensada
primeiro para o celular.

- **Participante** — vê seu personagem, lê o roteiro com as próprias falas
  destacadas, consulta os ensaios e o histórico de peças.
- **Direção (administrador)** — cadastra pessoas e características, cria peças e
  personagens, monta o elenco, escreve e publica o roteiro, marca os ensaios.

## Tecnologias

| Camada        | Escolha                                          |
| ------------- | ------------------------------------------------ |
| Interface     | Next.js 16 (App Router), React 19, TypeScript    |
| Estilo        | Tailwind CSS v4, tema escuro por tokens          |
| Tipografia    | DM Sans (interface), SUSE (rótulos), Manrope (números) |
| Ícones        | Phosphor Icons, peso regular                     |
| Autenticação  | Firebase Authentication (e-mail e senha)         |
| Banco         | Cloud Firestore                                  |
| Arquivos      | Firebase Storage (regras prontas)                |

Todo o acesso ao banco acontece no navegador, pelo SDK do Firebase, com as
permissões garantidas pelas regras em [`firestore.rules`](firestore.rules).

## Sistema visual

A interface segue o handoff de design guardado em [`design/`](design/):
[`design/HANDOFF.md`](design/HANDOFF.md) é a especificação completa (paleta,
tipografia, densidade, as 12 telas e os estados) e
[`design/tokens/`](design/tokens/) traz os tokens de origem.

Regras que valem em todo o app:

- **dark-first** — superfícies navio (`#062430` a `#0B3C51`), texto creme;
- **areia (`#A28F6A`) só como acento**; preenchimento areia leva tinta escura;
- separação por **hairline de 1px**, nunca sombra em card (sombra só em overlay);
- card raio 16, input e botão raio 8;
- texto de 10–12px nunca em areia pura — usa `brand-strong` ou `brand-soft`;
- **sem emoji**; ícones Phosphor com `currentColor`;
- alvo de toque mínimo de 48px no celular.

Os tokens vivem em [`src/app/globals.css`](src/app/globals.css) e os componentes
em [`src/components/ui.tsx`](src/components/ui.tsx). A marca do Aliança está em
`public/` — as três propostas de marca própria "Aliança Adonai" seguem
pendentes de escolha, então o app usa o símbolo da igreja.

## Estado atual

**No ar em <https://adonaiapp.web.app>**

Este repositório aponta para o projeto **AdonaiApp** (`adonaiapp-ba3e3`), fixado
em [`.firebaserc`](.firebaserc):

- Authentication com e-mail e senha — ativo
- Cloud Firestore `(default)` em modo nativo — ativo, com as regras de
  [`firestore.rules`](firestore.rules) publicadas
- Hosting — site `adonaiapp` servindo a exportação estática
- Características iniciais cadastradas, duas contas de administração e uma de
  participante criadas

Os nomes das duas contas de administração ficaram com um valor provisório (a
parte antes do @). Ajuste-os na tela **Pessoas**.

O `.env.local` com as chaves do app web fica fora do controle de versão. Para
recriá-lo em outra máquina:

```bash
firebase login
firebase apps:sdkconfig WEB --project adonaiapp-ba3e3
```

E copie os valores para `.env.local` seguindo o `.env.local.example`.

## Como configurar de novo, do zero

Os passos abaixo servem para recriar o ambiente em outro projeto Firebase.

### 1. Criar o projeto no Firebase

1. Em <https://console.firebase.google.com>, crie um projeto (ex.: `adonai-app`).
2. **Authentication › Sign-in method** → habilite **E-mail/senha**.
3. **Firestore Database** → criar banco (modo de produção, região mais próxima,
   por exemplo `southamerica-east1`).
4. **Storage** → criar (opcional, só se for enviar fotos pelo Firebase).
5. **Configurações do projeto › Seus aplicativos** → adicione um app **Web** e
   copie as chaves.

### 2. Configurar o ambiente

```bash
cp .env.local.example .env.local   # e preencha as chaves copiadas acima
npm install
npm run dev                        # http://localhost:3000
```

Enquanto o `.env.local` não estiver preenchido, o aplicativo abre uma tela
avisando que o Firebase não está configurado, em vez de quebrar.

### 3. Publicar as regras de segurança

Sem este passo o Firestore recusa ou libera acesso indevidamente.

```bash
npm install -g firebase-tools
firebase login
firebase use --add                 # escolha o projeto criado
firebase deploy --only firestore:rules,storage
```

### 4. Criar um administrador

O script usa uma conta de serviço: **Configurações do projeto › Contas de
serviço › Gerar nova chave privada**. Salve o JSON e aponte
`GOOGLE_APPLICATION_CREDENTIALS` para ele no `.env.local` — o `.gitignore` já
cobre o nome que o console gera (`*firebase-adminsdk*.json`).

```bash
npm run admin -- direcao@exemplo.com
```

Se a conta ainda não existir no Authentication, ela é criada e o script imprime
um link de uso único para a pessoa definir a senha. Para já definir a senha,
passe-a pela variável de ambiente — assim ela não aparece na lista de processos:

```bash
ADONAI_SENHA='senha-escolhida' npm run admin -- direcao@exemplo.com "Nome Completo"
```

O script marca a conta como administradora, garante um cadastro de pessoa com o
mesmo e-mail e vincula os dois. Pode ser executado novamente sem problema.

### 5. Criar acessos de participante (opcional)

O caminho normal é a direção cadastrar a pessoa em **Pessoas** e ela mesma criar
a conta em `/cadastro`. Quando for mais prático criar o acesso pela direção,
existe o atalho:

```bash
ADONAI_SENHA='senha-escolhida' npm run participante -- pessoa@exemplo.com "Nome Completo"
```

Ele cria a conta, o cadastro em `people` e o vínculo entre os dois de uma vez,
com papel de participante. Sem `ADONAI_SENHA`, imprime o link para a pessoa
definir a própria senha.

### 6. Cadastrar as características iniciais

```bash
npm run seed
```

Cria **Protagonista**, **Impõe a voz** e **Noção de espaço**. Novas
características podem ser criadas depois pela tela **Pessoas** — o sistema não
tem lista fixa.

## Instalação na tela de início (PWA)

O app é instalável: [`public/manifest.webmanifest`](public/manifest.webmanifest) e um
service worker mínimo em [`public/sw.js`](public/sw.js), que existe só para o
navegador oferecer a instalação — ele não guarda cache, porque leitura offline
do roteiro está nas evoluções e exige versionamento próprio.

São dois guias, escolhidos em `Guias`, dentro de
[`src/components/shell.tsx`](src/components/shell.tsx):

- **No navegador** — [`acesso/tutorial.tsx`](src/components/acesso/tutorial.tsx),
  quatro passos: como o app se organiza, como instalar na tela de início (com
  instruções por sistema quando não há o diálogo nativo do Chrome), a permissão
  de avisos e um resumo.
- **Rodando instalado** — [`acesso/tour-app.tsx`](src/components/acesso/tour-app.tsx),
  o tour completo que abre na primeira vez que o app é aberto pelo ícone. Passa
  por cada tela, traz uma demonstração ao vivo do destaque de fala com os
  mesmos estilos da tela real e, para administradores, um passo extra sobre a
  área da direção. Concluir o tour também dispensa o tutorial do navegador, já
  que ele cobre instalação e avisos.

A conclusão é marcada por aparelho no `localStorage`, não na conta — instalar é
uma ação de cada dispositivo. A tela de **Perfil** tem "Rever o tutorial", que
limpa as duas marcas e recarrega: no navegador volta o tutorial, instalado volta
o tour.

A permissão de notificação também fica no Perfil, no card **Avisos de ensaio**,
com o controle compartilhado
[`comum/notificacoes.tsx`](src/components/comum/notificacoes.tsx) — o mesmo que
o tutorial usa, para as duas telas não divergirem no tratamento de
concedido/bloqueado/indisponível.

**Os avisos ainda não são enviados.** A permissão é pedida e fica registrada no
navegador, mas falta o lado do envio: Firebase Cloud Messaging com chave VAPID e
um disparador (Cloud Functions, que pede plano Blaze). Até isso existir, os
ensaios são consultados na aba Ensaios.

### Zoom

O zoom está desligado dentro do app: `maximumScale`/`userScalable` no viewport,
`touch-action: manipulation` contra o toque duplo e campos a 16px em telas de
toque, que é o que evita o Safari ampliar sozinho ao focar um input. O Safari no
iOS mantém a pinça por decisão de acessibilidade da Apple — para ler o roteiro
com letra maior, use o controle de tamanho da própria tela.

### Prévia ao compartilhar o link

[`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) gera no build a
imagem 1200×630 que WhatsApp, Telegram e Facebook mostram, e as tags Open Graph
ficam em [`src/app/layout.tsx`](src/app/layout.tsx) com `metadataBase` absoluto
— esses aplicativos descartam `og:image` relativo.

A rota emite um arquivo sem extensão (`/opengraph-image`), então o
`Content-Type: image/png` é declarado à mão em
[`firebase.json`](firebase.json); sem isso o Firebase serve como
`application/octet-stream` e a prévia sai sem imagem.

**O WhatsApp guarda a prévia por URL e por bastante tempo.** Depois de mudar
título, descrição ou imagem, a prévia antiga continua aparecendo. Para forçar a
releitura, passe o endereço pelo
[Sharing Debugger do Facebook](https://developers.facebook.com/tools/debug/) —
que é a mesma infraestrutura de rastreamento — ou compartilhe uma vez com
`?v=2` no fim, que conta como outro endereço para o cache.

### Nome de exibição

`nomeCurto()` em [`src/lib/format.ts`](src/lib/format.ts) monta o nome com o
primeiro e o último nome, e é ele que aparece em saudações, cartões, tabelas e
listas. O cadastro completo continua em `people.nome` e é o que a direção edita.

## Como o acesso dos participantes funciona

1. A direção cadastra a pessoa em **Pessoas**, informando o **e-mail**.
2. A pessoa cria a conta em `/cadastro` usando **esse mesmo e-mail**.
3. O vínculo é automático: a conta passa a ver o personagem, o roteiro e os
   ensaios dela.

Se a pessoa se cadastrar antes de a direção registrá-la, o aplicativo mostra
"Aguardando o cadastro da direção" e faz o vínculo sozinho no próximo acesso,
assim que o cadastro existir.

## Estrutura

```
src/
  app/                             rotas (App Router)
    page.tsx                       encaminha para a área certa
    login/ cadastro/               acesso
    opengraph-image.tsx            prévia de compartilhamento, gerada no build
    (participante)/                início, personagem, roteiro, ensaios, histórico, perfil
                                   (tab bar: Início · Roteiro · Ensaios · Perfil)
    admin/                         painel, pessoas, peças, ensaios
      pecas/detalhe                uma peça (?id=), abas de dados/personagens/elenco
      pecas/roteiro                editor de roteiro (?id=)
      pessoas/detalhe              perfil administrativo (?id=)
  components/
    ui.tsx                         primitivos do design system
    shell.tsx                      proteção de rota e as duas navegações
    registro-sw.tsx                registra o service worker na carga
    acesso/                        moldura de login e tutorial de primeiro acesso
    comum/                         cartões usados nas duas áreas
    admin/                         abas da tela de peça
  lib/
    types.ts                       modelo de dados
    db.ts                          acesso ao Firestore e regras de negócio
    auth-context.tsx               sessão, cadastro e vínculo com a pessoa
    instalacao.ts                  instalação como app e permissões
    hooks.ts  format.ts  erros.ts  firebase.ts  uso-atual.ts
firebase/                          firestore.rules, storage.rules, índices
firebase.json  .firebaserc         configuração do CLI (precisam ficar na raiz)
scripts/
  provisionar-conta.mjs            criação de conta + cadastro + vínculo
  admin.mjs  participante.mjs      papéis, chamando o módulo acima
  seed.mjs                         características iniciais
  firebase-admin-app.mjs           credenciais dos scripts
design/                            handoff de design (HANDOFF.md + tokens)
public/                            marca do Aliança, ícones, manifesto, sw.js
```

A chave da conta de serviço **não** fica no projeto: o caminho dela é apontado
por `GOOGLE_APPLICATION_CREDENTIALS` no `.env.local`. Guarde o arquivo fora de
pasta sincronizada — esta aqui está no OneDrive.

## Modelo de dados (Firestore)

| Coleção                        | Conteúdo                                            |
| ------------------------------ | --------------------------------------------------- |
| `users/{uid}`                  | conta de acesso: perfil e vínculo com a pessoa      |
| `people/{id}`                  | integrante: dados, foto, características, situação  |
| `people/{id}/privado/direcao`  | observações internas — **só a direção lê**          |
| `traits/{id}`                  | características de atuação (lista extensível)       |
| `plays/{id}`                   | peça: título, capa, datas, status, peça atual       |
| `plays/{id}/characters/{id}`   | personagem e pessoa escalada                        |
| `plays/{id}/lines/{id}`        | linha do roteiro: ato, cena, tipo, personagem, texto |
| `rehearsals/{id}`              | ensaio: data, horário, local, convocados, status    |
| `participations/{id}`          | histórico, criado quando a peça é concluída         |

Datas de ensaio e apresentação são guardadas como texto `AAAA-MM-DD`, o que
evita erros de fuso horário e mantém a ordenação simples.

## Regras de negócio implementadas

- Só **uma peça** é a peça atual; ao definir outra, a anterior é desmarcada.
- Cada personagem pertence a uma única peça e aceita **uma pessoa por vez**;
  escalar alguém em outro papel libera o anterior.
- O histórico é gravado **apenas ao concluir a peça**, e a quantidade de peças
  de cada pessoa vem desse histórico.
- Sem personagem na peça atual, o participante vê **"Nos vemos na próxima
  peça!"** e continua com acesso ao histórico.
- Cada fala é vinculada a um personagem — é esse vínculo que destaca as falas do
  participante conectado.
- O roteiro só aparece para o elenco depois de **publicado**; publicar de novo
  gera uma nova versão.
- Observações internas da direção ficam em subcoleção separada, inacessível ao
  participante pelas regras do Firestore.
- Pessoa desativada continua no histórico das peças anteriores.
- A confirmação de presença é respondida pela própria pessoa: o documento fica
  em `rehearsals/{id}/presencas/{personId}`, com o id da pessoa, então ninguém
  sobrescreve a resposta de outro. A direção pode corrigir qualquer uma.

Notas sobre o roteiro: atos e cenas têm título próprio ("Ato II — A espera",
"Cena 3 · O retorno"), guardados repetidos nas linhas — não existe coleção
separada de atos e cenas, e por isso toda cena nasce junto com a primeira linha
dela. As alterações no editor são gravadas ao sair do campo, e a peça guarda a
data da última edição e da última publicação.

## Cadastro de primeiro acesso

Na primeira entrada, antes do tutorial, o participante responde o formulário de
[`acesso/cadastro-pessoa.tsx`](src/components/acesso/cadastro-pessoa.tsx): nome
completo, telefone, data de nascimento, dados do responsável quando menor de
18 anos, se já atuou antes e — se sim — há quanto tempo faz teatro e em quantas
peças já atuou.

As duas últimas são faixas, não números livres: experiência em `menos de 1 ano`
/ `1 a 2` / `3 a 5` / `mais de 5 anos`, e peças em `1` / `2 a 3` / `4 a 6` /
`7 a 9` / `10+`. Faixas evitam falsa precisão e são mais rápidas de responder no
celular. A primeira faixa de peças ficou `1` e `2 a 3` em vez de `1` e `1 a 3`:
com sobreposição, quem fez exatamente uma peça teria duas respostas certas e o
dado sairia inconsistente.

Não tem botão de pular: são os dados que a direção usa para escalar e para
falar com o responsável de quem é menor. Se a pessoa fechar o app, o formulário
volta no próximo acesso e nada é perdido. A conclusão fica em
`people.cadastroCompletoEm` — na conta, não no aparelho, então não reaparece em
outro celular.

**Guardamos data de nascimento, não idade.** Idade envelhece sozinha, e é dela
que depende a exigência de responsável: quem cadastrasse 17 continuaria 17 para
sempre e o app deixaria de pedir o contato do responsável no momento certo. A
idade é calculada na hora de exibir.

O mesmo formulário é reaproveitado em **Perfil › Editar meus dados**. As regras
do Firestore liberam para a própria pessoa só os campos dela — e-mail, situação
no grupo e características de atuação continuam fechados, porque são,
respectivamente, o vínculo com a conta e avaliações da direção.

A direção vê as respostas no perfil administrativo, com etiqueta de "cadastro
pendente" para quem ainda não respondeu. As peças informadas aqui são as de
**antes** do AdonaiApp; as daqui continuam vindo do histórico de participações.

## Trocar entre as duas visões

Uma conta de administrador vê as duas áreas e alterna entre elas em qualquer
tela, celular ou computador:

- **Direção → participante**: pelo avatar, que abre o menu "Sua conta" com
  "Minha área de participante". No computador o avatar fica no rodapé da
  sidebar; no celular, na barra do topo.
- **Participante → direção**: em **Perfil**, no item "Área da direção".

A área da direção tem três larguras, em [`shell.tsx`](src/components/shell.tsx):

| Largura | Navegação |
| --- | --- |
| ≥ 1100px | sidebar de 248px com os rótulos |
| 900–1100px | a mesma sidebar colapsada em ícones, como no handoff |
| < 900px | sem sidebar: barra no topo com a conta e tab bar embaixo |

Abaixo de 900px o trilho de ícones sai de cena de propósito: 68px fixos comem
largura demais na tela de um celular, e os cinco destinos ficam melhor numa tab
bar ao alcance do polegar — o mesmo padrão da área do participante.

## Avisos por notificação

A direção compõe o aviso em `/admin/avisos` (com modelos prontos, inclusive
"Não esqueça do ensaio!") e escolhe o alvo: convocados de um ensaio, elenco da
peça atual ou todos os integrantes ativos. O aviso entra em `avisos/{id}` com
status `pendente`.

**A entrega acontece fora do navegador**, em
[`scripts/enviar-avisos.mjs`](scripts/enviar-avisos.mjs):

```bash
npm run avisos           # envia os pendentes
npm run avisos -- --dry  # só mostra quem receberia
```

Mandar push exige credencial de servidor, que não pode ficar no cliente. O
disparador resolve os destinatários, envia pelo FCM, grava o resultado no aviso
e remove das contas os tokens que o FCM recusou.

O aparelho entra na lista de destinatários quando a pessoa autoriza os avisos —
o token vai para `users/{uid}.tokensFcm` e é reconfirmado a cada abertura do
app, porque tokens do FCM giram. Quem não autoriza continua vendo tudo pela aba
Ensaios.

Dois pré-requisitos para os avisos saírem de fato:

1. **Chave push da Web** em `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Configurações do
   projeto › Cloud Messaging › Certificados push da Web). Sem ela o app pede e
   guarda a permissão, mas nenhum token é emitido.
2. **Envio automático** exige o plano Blaze e uma Cloud Function disparada na
   criação do documento. A lógica do disparador já está no formato que a função
   usaria; até então, o envio é manual pelo comando acima.

O push é recebido pelo próprio [`public/sw.js`](public/sw.js), pelo evento
padrão da Web Push API — sem o SDK do Firebase dentro do worker e sem um segundo
service worker só para mensagens.

## Desempenho

O app é todo renderizado no navegador, então o que se sente como lentidão vem de
duas fontes: o peso do JavaScript e o número de idas ao Firestore.

**Bundle:** ~363 KB comprimidos na primeira tela, dominados pelo SDK do Firebase
(Firestore, Auth e Messaging). Os ícones do Phosphor entram só os usados —
verificado procurando no build ícones que o app não importa. Depois da primeira
visita o JavaScript vem do cache do navegador, com `Cache-Control` de um ano nos
arquivos de `/_next/static`.

**Idas ao banco:** a regra é evitar consulta encadeada e nunca baixar uma
coleção inteira para mostrar um número.

- A tela de **Início** faz três passos em vez de seis consultas em série: peça e
  histórico em paralelo, depois personagem e ensaios em paralelo, e por fim as
  falas.
- **Início** e **Meu personagem** usam `listarFalasDoPersonagem`, que filtra por
  `characterId`. Antes baixavam o roteiro completo só para contar "14 falas
  suas". Num teste com 250 falas e 3 personagens, a consulta filtrada leu 84
  documentos em vez de 250 — 66% menos; com um elenco real, de dez ou mais
  personagens, a diferença passa de 90%.
- O total de cenas da peça é gravado em `plays.totalCenas` na publicação do
  roteiro, então a tela do personagem não precisa varrer as falas para saber o
  tamanho da peça.

O roteiro e o editor continuam lendo todas as falas, porque é o que eles
mostram.

**Cache de tela:** `useCarregar` guarda o resultado por sessão em
[`hooks.ts`](src/lib/hooks.ts). Voltar a uma aba mostra na hora o que já foi
carregado e revalida por trás, em vez de exibir esqueleto e buscar tudo de novo.

Duas decisões desse cache merecem nota:

- **O nome é obrigatório** (`useCarregar("inicio", …)`). Metade das telas usa
  `[]` como dependência; sem um nome por chamada, elas colidiriam na mesma
  chave e uma mostraria os dados da outra. Há uma checagem simples possível:
  procurar por `useCarregar<` no `src/` e conferir que todo nome é único.
- **O cache é esvaziado na troca de conta**, em `auth-context`. Sem isso, quem
  entrasse depois veria por um instante os dados de quem saiu.

Erros não entram no cache: voltar a uma tela que falhou tenta de novo, em vez de
exibir na hora a falha anterior.

## Comandos

| Comando             | O que faz                                        |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | ambiente de desenvolvimento                      |
| `npm run build`     | gera o site estático em `out/`                   |
| `npm run preview`   | serve `out/` pelo emulador de hosting            |
| `npm run deploy`    | build e publicação no Firebase Hosting           |
| `npm run typecheck` | verificação de tipos                             |
| `npm run lint`      | ESLint                                           |
| `npm run admin`     | cria ou promove uma conta a administrador        |
| `npm run participante` | cria uma conta de participante                |
| `npm run seed`      | cadastra as características iniciais             |
| `npm run avisos`    | entrega os avisos pendentes (`-- --dry` simula)  |

Não existe `npm start`: com `output: "export"` o Next.js não sobe servidor —
use `npm run preview`.

## Publicação

Todo o aplicativo é renderizado no navegador, então ele é exportado como site
estático (`output: "export"` em [`next.config.ts`](next.config.ts)) e servido
pelo Firebase Hosting, dentro do plano gratuito — sem servidor e sem Cloud
Functions.

```bash
npm run deploy     # next build && firebase deploy --only hosting
```

É essa escolha que explica as rotas de detalhe com query string
(`/admin/pecas/detalhe?id=…`): rota dinâmica em exportação estática exigiria
conhecer todos os ids no momento do build, e eles vêm do Firestore.

As chaves `NEXT_PUBLIC_*` do Firebase são públicas por natureza: a proteção real
dos dados vem das regras do Firestore, por isso publicá-las não é opcional.

## Próximos passos (seção 11 do briefing)

Ficaram de fora do MVP, como combinado: confirmação de presença e faltas,
notificações e lembretes, anotações pessoais no roteiro, busca no roteiro, modo
escuro, exportação em PDF, leitura offline, integração com o Google Calendar,
upload de figurinos, equipes técnicas e relatórios.
