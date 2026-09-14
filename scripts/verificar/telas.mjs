/**
 * Abre todas as telas nos dois papéis e escuta.
 *
 * Erro de console, exceção, requisição que falhou, tela que ficou vazia e
 * desvio inesperado. Só navega — nenhum formulário é enviado, nenhum botão que
 * grava é clicado.
 *
 * Tela vazia é o sintoma mais útil aqui: quando uma regra do Firestore recusa
 * uma leitura que a tela precisa, o app não quebra — ele fica em branco. Foi
 * assim que a troca de foto quebrou sem ninguém ver erro nenhum.
 */
import { chromium } from "playwright-core";
import { db } from "../firebase-admin-app.mjs";
import { CHROME, SITE } from "./ambiente.mjs";
import { contaDoPapel, entrarComo } from "./sessao.mjs";
import { criarCaderno } from "./relatorio.mjs";

export const nome = "telas";
export const titulo = "Todas as telas, nos dois papéis";

const DO_ELENCO = ["/inicio", "/roteiro", "/ensaios", "/exercicios", "/historico", "/perfil"];
const DA_DIRECAO = [
  "/admin",
  "/admin/pessoas",
  "/admin/pecas",
  "/admin/ensaios",
  "/admin/exercicios",
  "/admin/avisos",
  "/admin/pecas/antiga",
];

/** Quanto texto uma tela precisa ter para não ser considerada vazia. */
const MINIMO_DE_TEXTO = 40;

/**
 * O esqueleto de carregamento, que é `role="status"` e só ele no app inteiro.
 *
 * Esperar ele sumir é o que separa "a tela abriu" de "a moldura apareceu". Sem
 * isso o teste media a barra de navegação: passava com a tela ainda vazia por
 * baixo, que é justamente o defeito que ele existe para achar.
 */
const CARREGANDO = '[role="status"]';

/** Por quanto tempo seguido a tela precisa estar pronta para valer. */
const ESTAVEL_POR = 500;

/** O que a tela mostra quando a leitura falhou, para diferenciar de vazio. */
const TEXTO_DE_ERRO = /não foi possível|tente de novo|tentar novamente|sem permissão/i;

/*
 * Ruído que não é defeito do app.
 *
 * `ERR_ABORTED` é o Next cancelando o prefetch de uma rota quando a navegação
 * muda — acontece porque o teste pula de tela em tela mais rápido que
 * qualquer pessoa. O canal longo do Firestore é cancelado pelo mesmo motivo.
 */
const ignorarFalha = (url, motivo) =>
  motivo.includes("ERR_ABORTED") || url.includes("firestore.googleapis.com/google.firestore");
const ignorarConsole = (t) => /favicon/.test(t);

export async function rodar() {
  if (!CHROME) {
    throw new Error(
      "Não encontrei o Chrome. Aponte ADONAI_CHROME para o executável no .env.local.",
    );
  }

  const { achados, anotar } = criarCaderno();
  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  const detalhe = [];

  try {
    const pecaAtual =
      (await db.collection("plays").where("atual", "==", true).limit(1).get()).docs[0] ??
      (await db.collection("plays").limit(1).get()).docs[0];
    const algumPapel = (await pecaAtual.ref.collection("characters").limit(1).get()).docs[0];
    const algumaPessoa = (await db.collection("people").limit(1).get()).docs[0];

    /* As telas de detalhe precisam do id no endereço; sem ele não há o que abrir. */
    const comId = [
      algumPapel ? `/personagem?id=${algumPapel.id}&peca=${pecaAtual.id}` : null,
      `/admin/pecas/detalhe?id=${pecaAtual.id}`,
      `/admin/pessoas/detalhe?id=${algumaPessoa.id}`,
    ].filter(Boolean);

    for (const [papel, rotas] of [
      ["participante", DO_ELENCO],
      ["admin", [...DO_ELENCO, ...DA_DIRECAO, ...comId]],
    ]) {
      const conta = await contaDoPapel(papel);
      const sessao = await entrarComo(conta.uid);
      detalhe.push(`${papel} — ${sessao.email}`);
      await percorrer(navegador, sessao, rotas, anotar, detalhe);
    }
  } finally {
    await navegador.close();
  }

  return { achados, resumo: `${detalhe.filter((l) => l.includes("ms")).length} telas abertas`, detalhe };
}

async function percorrer(navegador, sessao, rotas, anotar, detalhe) {
  const contexto = await navegador.newContext({ viewport: { width: 412, height: 915 } });

  // Planta a sessão onde o SDK do Firebase a procura, antes de qualquer script.
  await contexto.addInitScript(
    ({ chave, usuario }) => {
      const pedido = indexedDB.open("firebaseLocalStorageDb", 1);
      pedido.onupgradeneeded = () =>
        pedido.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
      pedido.onsuccess = () => {
        const bd = pedido.result;
        if (!bd.objectStoreNames.contains("firebaseLocalStorage")) return;
        bd.transaction("firebaseLocalStorage", "readwrite")
          .objectStore("firebaseLocalStorage")
          .put({ fbase_key: `firebase:authUser:${chave}:[DEFAULT]`, value: usuario });
      };
    },
    { chave: sessao.paraONavegador.apiKey, usuario: sessao.paraONavegador },
  );

  const pagina = await contexto.newPage();
  let rotaAtual = "";

  pagina.on("console", (m) => {
    if (m.type() !== "error" || ignorarConsole(m.text())) return;
    anotar("alta", rotaAtual, `erro no console: ${m.text().slice(0, 150)}`);
  });
  pagina.on("pageerror", (e) => anotar("alta", rotaAtual, `exceção: ${e.message.slice(0, 150)}`));
  pagina.on("requestfailed", (r) => {
    const motivo = r.failure()?.errorText ?? "";
    if (ignorarFalha(r.url(), motivo)) return;
    anotar("média", rotaAtual, `requisição falhou (${motivo}): ${r.url().slice(0, 90)}`);
  });

  for (const rota of rotas) {
    rotaAtual = rota;
    const inicio = Date.now();
    await pagina.goto(SITE + rota, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});

    const terminou = await esperarAssentar(pagina);
    const texto = (await pagina.evaluate(() => document.body.innerText)).trim();
    const ms = Date.now() - inicio;
    const destino = new URL(pagina.url()).pathname.replace(/\/$/, "");
    const pedida = rota.split("?")[0].replace(/\/$/, "");

    let marca;
    if (destino !== pedida) {
      marca = `desviou para ${destino}`;
      // Encaminhamento de endereço antigo é de propósito; o que interessa é
      // acabar em tela de acesso, que significa que a permissão falhou.
      if (/^\/(login|cadastro|convite)?$/.test(destino)) {
        anotar("alta", rota, `caiu na tela de acesso (${destino})`);
      }
    } else if (!terminou) {
      const vazia = texto.length < MINIMO_DE_TEXTO;
      marca = vazia ? "TELA VAZIA" : "PRESA CARREGANDO";
      anotar(
        "alta",
        rota,
        vazia
          ? "abriu vazia — provável leitura recusada pelas regras"
          : "ficou no esqueleto de carregamento e não terminou",
      );
    } else if (TEXTO_DE_ERRO.test(texto)) {
      marca = "ERRO NA TELA";
      anotar("alta", rota, `mostrou erro ao carregar: "${primeiraFrase(texto)}"`);
    } else {
      marca = `${texto.length} caracteres`;
    }
    detalhe.push(`  ${rota.padEnd(48)} ${String(ms).padStart(5)} ms  ${marca}`);
  }

  await contexto.close();
}

/**
 * Espera a tela assentar de verdade, e diz se assentou.
 *
 * "Assentou" é: sem esqueleto de carregamento **e** com texto, mantido por
 * meio segundo seguido. A insistência não é paranoia — o app é exportado
 * estático, então o HTML que chega do Hosting já vem com a moldura desenhada.
 * Quem olhasse uma vez veria texto antes de o React montar, aprovaria a tela,
 * e só depois ela viraria esqueleto vazio. Foi o que aconteceu: /perfil
 * passava com 997 caracteres num teste e vinha vazia no seguinte, sem nada ter
 * mudado no app.
 *
 * Voltar `false` (tempo estourado) é achado: tela que não assenta em 25
 * segundos não assenta para ninguém.
 */
async function esperarAssentar(pagina) {
  return pagina
    .waitForFunction(
      ({ minimo, estavel, seletor }) => {
        const pronta =
          !document.querySelector(seletor) && document.body.innerText.trim().length > minimo;
        if (!pronta) {
          window.__prontaDesde = 0;
          return false;
        }
        // Começou a contar agora: ainda não conta como assentada.
        if (!window.__prontaDesde) {
          window.__prontaDesde = performance.now();
          return false;
        }
        return performance.now() - window.__prontaDesde >= estavel;
      },
      { minimo: MINIMO_DE_TEXTO, estavel: ESTAVEL_POR, seletor: CARREGANDO },
      { timeout: 25000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
}

/** A frase da mensagem de erro que a tela mostrou, para o relatório. */
function primeiraFrase(texto) {
  const linha = texto
    .split("\n")
    .map((l) => l.trim())
    .find((l) => TEXTO_DE_ERRO.test(l));
  return (linha ?? texto).slice(0, 110);
}
