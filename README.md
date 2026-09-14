# AdonaiApp

Aplicativo web do teatro da **Igreja Aliança**: centraliza integrantes, peças,
personagens, elenco, roteiro e ensaios em um só lugar. A interface é pensada
primeiro para o celular.

- **Participante** — vê seu personagem, lê o roteiro com as próprias falas
  destacadas, consulta os ensaios, faz os exercícios de teatro que a direção
  indica e consulta o histórico de peças.
- **Direção (administrador)** — cadastra pessoas e características, convida
  quem ainda não tem acesso, cria peças e personagens, monta o elenco, escreve
  e publica o roteiro, marca os ensaios, manda avisos e cadastra os exercícios.

## Tecnologias

| Camada        | Escolha                                          |
| ------------- | ------------------------------------------------ |
| Interface     | Next.js 16 (App Router), React 19, TypeScript    |
| Estilo        | Tailwind CSS v4, tema escuro por tokens          |
| Tipografia    | DM Sans (interface), SUSE (rótulos), Manrope (números) |
| Ícones        | Phosphor Icons, peso regular                     |
| Autenticação  | Firebase Authentication (e-mail e senha)         |
| Banco         | Cloud Firestore                                  |
| Arquivos      | Firebase Storage                                 |
| Servidor      | Cloud Functions v2 (avisos, lembretes, convites, claims) |

Quase todo o acesso ao banco acontece no navegador, pelo SDK do Firebase, com
as permissões garantidas pelas regras em
[`firebase/firestore.rules`](firebase/firestore.rules) e
[`firebase/storage.rules`](firebase/storage.rules). O que fica no servidor é o
que o navegador não pode fazer sem abrir uma brecha — ver
[Cloud Functions](#cloud-functions).

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
  [`firebase/firestore.rules`](firebase/firestore.rules) publicadas
- Storage — ativo, com as regras de
  [`firebase/storage.rules`](firebase/storage.rules) publicadas
- Cloud Functions — plano Blaze, funções de
  [`functions/`](functions/) publicadas em `southamerica-east1`
- Hosting — site `adonaiapp` servindo a exportação estática
- O acervo do grupo está carregado: as peças anteriores, o elenco de cada uma e
  o histórico de participações. O restante do grupo entra por convite.

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
4. **Storage** → criar. É onde ficam as fotos de perfil e as capas.
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

As Cloud Functions vão junto, se o projeto estiver no plano Blaze — sem elas o
convite não é resgatado e os avisos não saem:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
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

O app é instalável: [`public/manifest.webmanifest`](public/manifest.webmanifest) e o
service worker de [`public/sw.js`](public/sw.js), que faz três coisas — guarda a
casca do aplicativo, existe (o Chrome só oferece a instalação para quem tem um
manipulador de `fetch`) e recebe os push.

**O que ele guarda é o programa, nunca o dado.** HTML e JavaScript ficam no
cache; Firestore, Storage e as capas do YouTube são de outra origem e passam
direto para a rede, sempre. Roteiro desatualizado no ensaio seria pior que app
que não abre. As telas do elenco entram já na instalação, não na primeira
visita — quem instala costuma abrir só o Início, e sem isso as outras abas
falhariam no primeiro ensaio sem sinal. Os arquivos de `/_next/static` têm o
hash do conteúdo no nome, então respondem do cache sem perguntar à rede; o HTML
vai à rede primeiro e só cai no cache quando ela não responde.

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

Os avisos são entregues de fato — ver [Avisos por notificação](#avisos-por-notificação).
Quem não autoriza a permissão continua vendo tudo pela aba Ensaios.

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

Dois caminhos. O **convite** é o normal; o e-mail é o de trás.

### Por convite (recomendado)

1. Na ficha da pessoa, em **Pessoas**, a direção gera o convite. Sai um código
   de 8 caracteres, um link e um QR — o que for mais prático de mandar.
2. A pessoa abre o link (ou digita o código, ou lê o QR em `/convite`),
   confirma que o nome é o dela e escolhe e-mail e senha.
3. A conta nasce já ligada àquela ficha.

O código vale 7 dias e serve uma vez. As duas etapas são separadas de propósito:
confirmar o nome antes de pedir e-mail e senha evita o pior caso da tela, que é
preencher tudo e só no fim descobrir que usou o código de outra pessoa.

A leitura do QR usa o `BarcodeDetector` quando o navegador tem, e cai no
[jsQR](https://github.com/cozmo/jsQR) quando não — o Chrome do Windows e o
Safari do iOS não têm.

Pelo terminal, quando é mais rápido mandar vários de uma vez:

```bash
npm run convite -- "Sarah Thomazi"
npm run convite -- "Sarah Thomazi" --novo   # ignora convite em aberto
```

### Pelo e-mail

1. A direção cadastra a pessoa em **Pessoas**, informando o **e-mail**.
2. A pessoa cria a conta em `/cadastro` usando **esse mesmo e-mail**.
3. O vínculo é automático.

Se a pessoa se cadastrar antes de a direção registrá-la, o aplicativo mostra
"Aguardando o cadastro da direção" e faz o vínculo sozinho no próximo acesso,
assim que o cadastro existir. É o caminho que sobra quando o convite venceu ou
quando a pessoa já criou a conta por conta própria.

## Exercícios de teatro

A direção cadastra em `/admin/exercicios` o nome do exercício, o objetivo e um
link do YouTube, e ordena a lista na ordem em que quer que sejam feitos. O
elenco vê a mesma lista em `/exercicios` e toca para abrir o vídeo.

O vídeo abre **no YouTube**, não embutido. Embutir custaria o `iframe` do
player em toda a lista, e o aplicativo do YouTube já está instalado no celular
de quem vai assistir. [`src/lib/youtube.ts`](src/lib/youtube.ts) extrai o id do
endereço — aceita `youtube.com/watch`, `youtu.be` e `/shorts/` — e monta a capa
a partir dele, que é a única coisa que a lista baixa do YouTube.

## Acervo: peças que já aconteceram

O caminho normal de uma peça — planejamento, escalação, ensaios, conclusão —
existe para acompanhar uma produção em andamento. Para peça antiga ele é só
trabalho: ninguém vai ensaiar o que já foi apresentado, e o que interessa é que
a participação de cada um entre no histórico.

Por isso **Peças › Cadastrar peça antiga** é um formulário só, e a peça nasce
concluída, com as participações gravadas de uma vez. Roteiro não é pedido: peça
antiga raramente tem o texto à mão, e exigi-lo impediria de registrar o que se
lembra.

O acervo inicial do grupo entrou por script, que faz o mesmo em lote:

```bash
npm run acervo           # confere
npm run acervo -- --aplicar
```

Um lote por peça, e idempotente: peça que já tem personagem não recebe elenco
de novo. Elenco pela metade no histórico é pior que elenco nenhum, porque
ninguém percebe o que ficou faltando.

## O que é pessoal não fica na ficha

`people` é lido por todo o elenco — a lista de elenco precisa de nome e foto.
Então **e-mail, telefone, data de nascimento e o contato do responsável não
moram ali**: ficam em `people/{id}/privado/contato`, que só a direção e a
própria pessoa leem. Antes disso, o telefone do responsável de uma menor de
idade estava à vista de qualquer um com conta.

O e-mail foi o último a sair, e ficou para trás por um motivo que deixou de
valer: o app ligava conta nova à pessoa cadastrada com o mesmo endereço. Esse
vínculo automático não existe mais — a direção liga à mão, e o convite já vem
ligado —, então ele era só o endereço de todo mundo à vista de todo mundo.

Dentro do contato ele é o único campo que a **pessoa não escreve**: é por ele
que a direção reconhece quem é quem ao ligar uma conta a uma ficha, e deixar a
própria pessoa reescrevê-lo seria dar a ela como a direção a identifica.

O que sobrou na ficha pública é o que a lista de elenco mostra de fato: nome,
foto, situação no grupo, experiência e as peças anteriores. As regras do
Firestore listam esses campos um a um, e a lista é o que a própria pessoa pode
escrever — situação no grupo e características de atuação continuam fechadas,
porque são decisão do grupo e avaliação da direção.

As observações internas da direção ficam em `people/{id}/privado/direcao`, e as
características de atuação em `direcao/caracteristicas` — as duas fora do
alcance de quem é participante.

## Estrutura

```
src/
  app/                             rotas (App Router)
    page.tsx                       encaminha para a área certa
    login/ cadastro/               acesso por e-mail e senha
    convite/                       primeiro acesso por código, link ou QR
    opengraph-image.tsx            prévia de compartilhamento, gerada no build
    (participante)/                início, personagem, roteiro, ensaios,
                                   exercícios, histórico, perfil
                                   (tab bar: Exercícios · Roteiro · Início · Ensaios · Perfil)
    admin/                         painel, pessoas, peças, ensaios, exercícios, avisos
      pecas/detalhe                uma peça (?id=), abas de dados/personagens/elenco/roteiro
      pecas/antiga                 cadastro de peça que já aconteceu
      pecas/roteiro                endereço antigo, encaminha para a aba
      pessoas/detalhe              perfil administrativo (?id=)
  components/
    ui.tsx                         primitivos do design system
    shell.tsx                      proteção de rota e as duas navegações
    registro-sw.tsx                registra o service worker na carga
    acesso/                        moldura de login, tutorial, tour, leitor de QR
    comum/                         cartões e controles usados nas duas áreas
    admin/                         abas da tela de peça e o convite da pessoa
  lib/
    types.ts                       modelo de dados
    db.ts                          acesso ao Firestore e regras de negócio
    auth-context.tsx               sessão, cadastro e vínculo com a pessoa
    armazenamento.ts               envio de imagem, caminhos e miniaturas
    convite.ts  funcoes.ts         código do convite e chamada das functions
    youtube.ts                     id e capa a partir do endereço
    instalacao.ts                  instalação como app e permissões
    hooks.ts  format.ts  erros.ts  firebase.ts  uso-atual.ts
functions/                         Cloud Functions (avisos, lembrete, convite, claims)
firebase/                          firestore.rules, storage.rules, índices
firebase.json  .firebaserc         configuração do CLI (precisam ficar na raiz)
scripts/
  firebase-admin-app.mjs           credenciais dos scripts
  provisionar-conta.mjs            criação de conta + cadastro + vínculo
  admin.mjs  participante.mjs      papéis, chamando o módulo acima
  convite.mjs                      gera o convite de alguém do cadastro
  seed.mjs                         características iniciais
  subir-acervo.mjs                 peças antigas, elenco e direção, em lote
  enviar-avisos.mjs                entrega manual dos avisos pendentes
  gerar-miniaturas.mjs             versão pequena das imagens que já estão lá
  corrigir-segmentos.mjs           roda no build, ver Publicação
design/                            handoff de design (HANDOFF.md + tokens)
public/                            marca do Aliança, ícones, manifesto, sw.js
```

Os demais scripts são de manutenção pontual — migração de dado, correção de
cadastro, renomeação de arquivo no Storage. Cada um explica no próprio
cabeçalho o que faz e quando foi preciso, e todos conferem antes de gravar:
sem `--aplicar` eles só mostram o que fariam.

A chave da conta de serviço **não** fica no projeto: o caminho dela é apontado
por `GOOGLE_APPLICATION_CREDENTIALS` no `.env.local`. Guarde o arquivo fora de
pasta sincronizada — esta aqui está no OneDrive.

## Modelo de dados (Firestore)

| Coleção                             | Conteúdo                                       | Quem lê |
| ----------------------------------- | ---------------------------------------------- | ------- |
| `users/{uid}`                        | conta de acesso: papel e vínculo com a pessoa  | a própria conta e a direção |
| `people/{id}`                        | integrante: nome, foto, situação, experiência  | todo o elenco |
| `people/{id}/privado/contato`        | telefone, nascimento, responsável              | a própria pessoa e a direção |
| `people/{id}/privado/direcao`        | observações internas                           | só a direção |
| `direcao/caracteristicas`            | características atribuídas a pessoas e papéis  | só a direção |
| `traits/{id}`                        | características de atuação (lista extensível)  | todo o elenco |
| `plays/{id}`                         | peça: título, capa, datas, status, peça atual  | todo o elenco |
| `plays/{id}/characters/{id}`         | personagem e pessoa escalada                   | todo o elenco |
| `plays/{id}/lines/{id}`              | linha do roteiro: ato, cena, tipo, personagem, texto | todo o elenco |
| `rehearsals/{id}`                    | ensaio: data, horário, local, convocados, status | todo o elenco |
| `rehearsals/{id}/presencas/{personId}` | confirmação de presença, uma por pessoa — apagadas junto com o ensaio | todo o elenco |
| `participations/{id}`                | histórico, criado quando a peça é concluída    | todo o elenco |
| `exercicios/{id}`                    | exercício de teatro: nome, objetivo, link, ordem | todo o elenco |
| `avisos/{id}`                        | aviso composto pela direção e o resultado da entrega | só a direção |
| `convites/{codigo}`                  | convite de primeiro acesso, ligado a uma ficha | **ninguém pelo cliente** — só a direção escreve, e a função lê |
| `limites/{chave}`                    | tentativas por origem nas funções abertas      | **ninguém pelo cliente** — só o servidor |

Datas de ensaio e apresentação são guardadas como texto `AAAA-MM-DD`, o que
evita erros de fuso horário e mantém a ordenação simples.

Imagens que aparecem pequenas em alguma lista existem em duas versões —
`fotoUrl`/`fotoMiniUrl` na pessoa, `capaUrl`/`capaMiniUrl` na peça. A pasta no
Storage é o id e o arquivo leva o nome de quem é a imagem; o id sustenta a
permissão e não pode mudar, o nome é rótulo. Ver
[`src/lib/armazenamento.ts`](src/lib/armazenamento.ts).

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
- Observações internas da direção, características de atuação e contato pessoal
  ficam fora da ficha que o elenco lê, cada um em seu lugar e fechado pelas
  regras do Firestore.
- Pessoa desativada continua no histórico das peças anteriores.
- **Um convite serve uma vez e vale 7 dias**, e já vem ligado a uma ficha. Duas
  fichas nunca acabam com a mesma conta, porque quem resgata não escolhe a
  ficha — o código escolhe.
- Renomear alguém propaga o nome para onde ele aparece copiado: os personagens
  que a pessoa fez e o nome na conta. O mesmo vale para a peça — mudar título,
  evento, capa ou data atualiza as participações do histórico.
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

As respostas vão para dois lugares: o que a lista de elenco mostra fica na
ficha, e telefone, nascimento e responsável vão para `privado/contato` — ver
[O que é pessoal não fica na ficha](#o-que-é-pessoal-não-fica-na-ficha).

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
largura demais na tela de um celular, e os destinos ficam melhor numa tab bar ao
alcance do polegar — o mesmo padrão da área do participante.

Na tab bar do participante o **Início fica no meio**, com dois vizinhos de cada
lado: é a aba que se abre mais vezes, e no celular o meio da barra é o ponto
mais fácil de alcançar com o polegar. Nas pontas a mão precisa se reposicionar.

## Avisos por notificação

A direção compõe o aviso em `/admin/avisos` (com modelos prontos, inclusive
"Não esqueça do ensaio!") e escolhe o alvo: convocados de um ensaio, elenco da
peça atual ou todos os integrantes ativos. O aviso entra em `avisos/{id}` com
status `pendente`.

**A entrega acontece fora do navegador**, porque mandar push exige credencial de
servidor. A função `entregarAviso` dispara na criação do documento: resolve os
destinatários, envia pelo FCM, grava o resultado no aviso e remove das contas os
tokens que o FCM recusou.

Existe também `lembrarDosEnsaios`, agendada para 7h30 de São Paulo: procura os
ensaios de amanhã e cria o aviso "Não esqueça do ensaio!" para os convocados.
Ela **cria o aviso** em vez de enviar direto, para o lembrete aparecer no
histórico da tela de Avisos como qualquer outro e a entrega continuar sendo de
uma função só. O campo `lembreteEm` no ensaio é a trava contra repetição.

O mesmo disparador existe como script, para reenvio manual e para depurar:

```bash
npm run avisos           # envia os pendentes
npm run avisos -- --dry  # só mostra quem receberia
```

O aparelho entra na lista de destinatários quando a pessoa autoriza os avisos —
o token vai para `users/{uid}.tokensFcm` e é reconfirmado a cada abertura do
app, porque tokens do FCM giram. Quem não autoriza continua vendo tudo pela aba
Ensaios.

Num projeto novo, dois pré-requisitos para os avisos saírem: a **chave push da
Web** em `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Configurações do projeto › Cloud
Messaging › Certificados push da Web), sem a qual o app pede a permissão mas
nenhum token é emitido; e o **plano Blaze**, que as Cloud Functions exigem.

O push é recebido pelo próprio [`public/sw.js`](public/sw.js), pelo evento
padrão da Web Push API — sem o SDK do Firebase dentro do worker e sem um segundo
service worker só para mensagens.

## Cloud Functions

Em [`functions/`](functions/), região `southamerica-east1` (São Paulo, mais
perto do elenco), todas com `maxInstances: 5` — é um grupo de teatro de uma
igreja, e o teto evita que um erro em laço vire fatura.

| Função | Gatilho | Por que não pode ser no navegador |
| --- | --- | --- |
| `entregarAviso` | criação em `avisos/{id}` | mandar push exige credencial de servidor |
| `lembrarDosEnsaios` | agendada, 7h30 | ninguém está com o app aberto às sete da manhã |
| `conferirConvite` · `resgatarConvite` | chamada da tela `/convite` | o convite escreve o vínculo conta ↔ ficha |
| `sincronizarClaims` | escrita em `users/{uid}` | claim de token só o Admin SDK grava |

As duas do convite são as mais delicadas. O vínculo `users/{uid}.personId` é o
que carrega histórico, personagem e convocação de alguém — se o cliente pudesse
escrevê-lo, qualquer um escolheria de quem quer ser. E nenhuma regra do
Firestore consegue conferir "esta pessoa apresentou um código válido", porque
conferir o código exige ler um documento que quem ainda não tem conta não pode
ler. Com a função no meio, `convites` fica fechada para todos menos a direção.

São também as únicas funções abertas a quem não tem conta, e a primeira
responde se um código existe — um oráculo para quem quiser varrer. Por isso
contam tentativas por origem em `limites/{chave}`: 30 conferências por 10
minutos e 10 resgates por hora, folgado para gente de verdade (quem digita
errado tenta duas ou três vezes) e inviável para varredura. A chave é o resumo
do IP, não o IP — contar tentativas não exige guardar o endereço de quem nem
conta tem. A coleção é fechada ao cliente: quem alcançasse o contador zeraria o
próprio limite.

`sincronizarClaims` espelha `role` e `personId` no token porque as regras do
Storage precisam saber de quem é a pasta para deixar a pessoa trocar a própria
foto. A alternativa — a regra consultar o Firestore a cada envio — custaria uma
leitura por requisição.

```bash
firebase deploy --only functions
```

## Desempenho

O app é todo renderizado no navegador, então o que se sente como lentidão vem de
duas fontes: o peso do JavaScript e o número de idas ao Firestore.

**Bundle:** dominado pelo SDK do Firebase (Firestore, Auth e Messaging), que
sozinho responde por metade do JavaScript da primeira tela. Os ícones do
Phosphor entram só os usados — verificado procurando no build ícones que o app
não importa. Depois da primeira visita o JavaScript vem do cache do navegador,
com `Cache-Control` de um ano nos arquivos de `/_next/static`, e do service
worker quando não há rede.

O custo que sobra na primeira abertura de um navegador zerado é esse: baixar e
iniciar o SDK, e esperar o Firebase confirmar a sessão. É igual em todas as
telas — o painel da direção não é mais pesado que o Início.

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
- O **painel da direção** conta no servidor o que só vira número na tela —
  quantas pessoas ativas, quantas falas o roteiro tem. Ele escrevia "42" depois
  de baixar as 42 fichas, e o tamanho do roteiro depois de baixar o roteiro.
  Só vem como documento o que a tela lista de fato: os personagens, porque ela
  nomeia os que estão sem ator, e os ensaios, porque ela abre o próximo.

O roteiro e o editor continuam lendo todas as falas, porque é o que eles
mostram.

**Imagens:** toda foto que aparece pequena tem uma versão pequena de verdade.
Os círculos de 28 a 56 pixels das listas usam uma miniatura de 128; o quadrado
de 64 da lista de peças usa uma de 192. As duas sobem junto com a original, na
mesma escolha de arquivo — gerar depois obrigaria a baixar a grande de volta.
A lista de peças baixava 522 KB de capa para desenhar sete quadradinhos; hoje
baixa 51 KB. [`scripts/gerar-miniaturas.mjs`](scripts/gerar-miniaturas.mjs)
cobre as imagens que subiram antes disso existir.

**Cache de tela:** `useCarregar` guarda o resultado em
[`hooks.ts`](src/lib/hooks.ts), em memória e **também em disco**, no
`localStorage`. Voltar a uma aba mostra na hora o que já foi carregado e
revalida por trás, em vez de exibir esqueleto e buscar tudo de novo; o disco faz
o mesmo valer na abertura seguinte do app, não só dentro da sessão.

Quatro decisões desse cache merecem nota:

- **O nome é obrigatório** (`useCarregar("inicio", …)`). Metade das telas usa
  `[]` como dependência; sem um nome por chamada, elas colidiriam na mesma
  chave e uma mostraria os dados da outra. Há uma checagem simples possível:
  procurar por `useCarregar<` no `src/` e conferir que todo nome é único.
- **A chave do disco leva o uid**, e o que é de outra conta é varrido na
  entrada. Cache de tela em disco é dado de alguém no aparelho: sem isso, quem
  entrasse depois veria por um instante os dados de quem saiu.
- **A leitura do disco passa por `useSyncExternalStore`.** Ler `localStorage`
  direto na renderização diverge da pré-renderização e o React derruba a
  página inteira com erro de hidratação.
- **O disco só é limpo em troca de conta de verdade.** A marca de "qual conta
  estava aqui" começa indefinida, não nula — com nula, toda abertura parecia
  troca de conta e o cache era apagado antes de ser usado uma vez.

Erros não entram no cache: voltar a uma tela que falhou tenta de novo, em vez de
exibir na hora a falha anterior.

**Sessão otimista:** o app guarda um retrato da última sessão e desenha a tela
com ele enquanto o Firebase confirma quem é. A confirmação (`accounts:lookup`)
leva meio segundo e antes segurava a primeira pintura — o app ficava em branco
esperando saber uma coisa que já sabia. Quando a confirmação chega e desmente o
retrato, o que está na tela é trocado.

## Verificação

```bash
npm run verificar                 # tudo, ~70 segundos
npm run verificar -- dados        # só uma parte
npm run verificar -- telas --detalhe
```

Quatro verificações, em ordem de custo:

| | O que confere |
| --- | --- |
| `dados` | o que aponta para o que: escalação, histórico, contas, claims, convites, e se algum campo pessoal voltou para a ficha pública |
| `permissoes` | 36 linhas de "um participante pode/não pode", no Firestore e no Storage — incluindo o que ele **deve** conseguir gravar |
| `imagens` | toda URL guardada responde, toda imagem tem versão pequena, e a lista baixa a pequena |
| `telas` | abre as 22 telas nos dois papéis e escuta erro de console, exceção, tela vazia e desvio |

Sai com 0 quando não há nada grave e 1 quando há — dá para pôr antes do deploy.

### Por que testa a produção, e o que isso exige

Não há emulador aqui de propósito. As três coisas que já quebraram de verdade
neste projeto — uma regra recusando uma gravação legítima, uma URL de imagem
apontando para arquivo que não existe mais, uma tela abrindo em branco por falta
de permissão — só acontecem com as regras publicadas, os dados reais e o site
publicado. Emulador teria passado nas três.

O preço é uma regra rígida: **nada aqui escreve em dado de ninguém.** As
verificações leem, e as gravações que tentam são as que **devem** falhar —
gravação negada não muda nada. Há um único ponto que precisa gravar um valor
diferente de verdade (a regra de `ativo`); ele lê o original antes e o devolve
num `finally`, aconteça o que acontecer.

Três armadilhas estão codificadas ali, cada uma porque já custou caro:

- **Gravação que não muda nada passa de graça.** As regras usam
  `diff().affectedKeys().hasOnly([...])`, e uma gravação que põe o valor que já
  estava não afeta chave nenhuma — `hasOnly` de lista vazia é sempre verdadeiro.
  Todo valor testado é escolhido para ser diferente do que está gravado.
- **"Deveria poder e foi negado" é tão grave quanto o contrário.** Regra
  apertada demais quebra o app em silêncio: foi um campo faltando na lista que
  fez o Firestore recusar a gravação inteira da troca de foto, sem erro visível.
- **A tela precisa assentar antes de ser medida.** O app é exportado estático,
  então o HTML já chega com a moldura desenhada — olhar uma vez só aprovaria
  uma tela que ainda ia virar esqueleto vazio. A verificação exige meio segundo
  seguido sem esqueleto e com texto.

A sessão dos testes é emitida na hora pelo Admin SDK e descartada no fim. **Não
existe arquivo de sessão em disco** — a versão anterior guardava um, e ele
acabou num commit público, o que obrigou a revogar as sessões de duas contas.

## Comandos

| Comando             | O que faz                                        |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | ambiente de desenvolvimento                      |
| `npm run build`     | gera o site estático em `out/`                   |
| `npm run preview`   | serve `out/` pelo emulador de hosting            |
| `npm run deploy`    | build e publicação no Firebase Hosting           |
| `npm run typecheck` | verificação de tipos                             |
| `npm run lint`      | ESLint                                           |
| `npm run verificar` | dados, permissões, imagens e telas contra o que está no ar |
| `npm run admin`     | cria ou promove uma conta a administrador        |
| `npm run participante` | cria uma conta de participante                |
| `npm run convite`   | gera o convite de primeiro acesso de alguém      |
| `npm run seed`      | cadastra as características iniciais             |
| `npm run acervo`    | sobe peças antigas, elenco e direção em lote     |
| `npm run avisos`    | entrega os avisos pendentes (`-- --dry` simula)  |
| `npm run claims`    | ressincroniza as claims de todas as contas       |
| `npm run miniaturas` | gera a versão pequena das imagens que não têm   |

Os scripts que gravam em lote conferem por padrão e só escrevem com
`-- --aplicar`. Eles precisam da conta de serviço em
`GOOGLE_APPLICATION_CREDENTIALS` — ver [Criar um administrador](#4-criar-um-administrador).

Não existe `npm start`: com `output: "export"` o Next.js não sobe servidor —
use `npm run preview`.

## Publicação

Todo o aplicativo é renderizado no navegador, então ele é exportado como site
estático (`output: "export"` em [`next.config.ts`](next.config.ts)) e servido
pelo Firebase Hosting — sem servidor de renderização.

```bash
npm run deploy     # build, publica e verifica
```

A verificação roda **depois** de publicar, de propósito: metade do que ela
confere (as telas, o peso das listas, as permissões contra as regras no ar) só
existe depois da publicação. Ela não impede um deploy ruim de sair; ela avisa,
com código de saída, que saiu.

Regras e funções publicam à parte, porque mudam em ritmo próprio:

```bash
firebase deploy --only firestore:rules,storage
firebase deploy --only functions
```

**Confira o resultado do build, não o da linha inteira.** `npm run build | grep
… && firebase deploy` publica mesmo com o build quebrado: quem decide é o
`grep`, e ele terminou bem.

É essa escolha que explica as rotas de detalhe com query string
(`/admin/pecas/detalhe?id=…`): rota dinâmica em exportação estática exigiria
conhecer todos os ids no momento do build, e eles vêm do Firestore.

As chaves `NEXT_PUBLIC_*` do Firebase são públicas por natureza: a proteção real
dos dados vem das regras do Firestore, por isso publicá-las não é opcional.

## O que ainda falta

Da lista de evoluções do briefing, já entraram: confirmação de presença e
faltas, notificações e lembretes, modo escuro (é o padrão) e a leitura offline
— parcial, o app abre sem rede e mostra o que já leu.

Continuam de fora: anotações pessoais no roteiro, busca no roteiro, exportação
em PDF, integração com o Google Calendar, upload de figurinos, equipes técnicas
e relatórios.

Fora do briefing, o que o projeto deve a si mesmo:

- A verificação cobre o que o participante grava na própria ficha, mas **não
  os fluxos da direção** — criar peça, escalar alguém, publicar roteiro,
  concluir, resgatar convite. Esses continuam conferidos à mão, porque exercer
  gravação de verdade exige um lugar para gravar que não seja a produção: ou o
  emulador do Firestore (que precisa de Java instalado), ou um segundo projeto
  Firebase só para teste.
- A contagem de tentativas em `limites` não é varrida sozinha. Os documentos
  carregam `expiraEm` para uma política de TTL do Firestore cuidar disso; a
  política ainda não foi criada no console. São poucos documentos (um por
  origem), então é arrumação, não problema.
