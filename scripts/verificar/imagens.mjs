/**
 * As imagens respondem, têm versão pequena, e as listas baixam a pequena.
 *
 * As três coisas já quebraram. A URL guardada apontando para arquivo que não
 * existe mais (renomeação feita na ordem errada); a miniatura faltando porque
 * o campo não estava na lista das regras e a gravação inteira era recusada; e
 * a lista baixando meio megabyte de capa para desenhar sete quadradinhos.
 */
import { chromium } from "playwright-core";
import { db } from "../firebase-admin-app.mjs";
import { CHROME, SITE } from "./ambiente.mjs";
import { contaDoPapel, entrarComo } from "./sessao.mjs";
import { criarCaderno } from "./relatorio.mjs";

export const nome = "imagens";
export const titulo = "Imagens e miniaturas";

/*
 * O que existe em duas versões, e onde a pequena aparece.
 *
 * `teto` é quanto a lista pode baixar de imagem ao abrir, em kB. Serve de
 * alarme: se alguém voltar a apontar a lista para a versão grande, o número
 * estoura e o teste reprova em vez de a lentidão passar despercebida.
 */
const PARES = [
  {
    rotulo: "fotos de perfil",
    colecao: "people",
    nome: (v) => v.nome,
    grande: "fotoUrl",
    pequena: "fotoMiniUrl",
    tela: "/admin/pessoas",
    teto: 120,
  },
  {
    rotulo: "capas de peça",
    colecao: "plays",
    nome: (v) => v.titulo,
    grande: "capaUrl",
    pequena: "capaMiniUrl",
    tela: "/admin/pecas",
    teto: 120,
  },
];

export async function rodar() {
  const { achados, anotar } = criarCaderno();
  const detalhe = [];

  /* --------------------------------------- toda URL guardada responde? */
  for (const par of PARES) {
    let comImagem = 0;
    let bytesGrandes = 0;
    let bytesPequenas = 0;

    for (const doc of (await db.collection(par.colecao).get()).docs) {
      const v = doc.data();
      if (!v[par.grande]) continue;
      comImagem++;

      for (const campo of [par.grande, par.pequena]) {
        const url = v[campo];
        if (!url) {
          anotar(
            "média",
            par.nome(v),
            `sem versão pequena — as listas baixam a imagem inteira (rode: npm run miniaturas)`,
          );
          continue;
        }
        const resposta = await fetch(url);
        const bytes = (await resposta.arrayBuffer()).byteLength;
        if (!resposta.ok) {
          anotar("alta", par.nome(v), `a imagem guardada responde ${resposta.status} — aparece quebrada`);
        }
        if (campo === par.grande) bytesGrandes += bytes;
        else bytesPequenas += bytes;
      }
    }

    detalhe.push(
      `  ${par.rotulo.padEnd(18)} ${comImagem} com imagem · ` +
        `${Math.round(bytesGrandes / 1024)} kB grandes · ${Math.round(bytesPequenas / 1024)} kB pequenas`,
    );
  }

  /* ------------------------- a lista está mesmo pedindo a versão pequena? */
  if (!CHROME) {
    anotar("baixa", "listas", "sem Chrome: não deu para conferir o que as listas baixam");
    return { achados, resumo: "URLs conferidas; listas não", detalhe };
  }

  const conta = await contaDoPapel("admin");
  const sessao = await entrarComo(conta.uid);
  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });

  try {
    for (const par of PARES) {
      const baixadas = await oQueATelaBaixa(navegador, sessao, par.tela);
      const grandes = baixadas.filter((i) => !i.nome.endsWith("-mini.jpg"));
      const total = baixadas.reduce((s, i) => s + i.kb, 0);

      detalhe.push(`  ${par.tela.padEnd(18)} ${baixadas.length} imagem(ns) · ${total} kB`);

      if (grandes.length > 0) {
        anotar(
          "média",
          par.tela,
          `baixou a imagem grande de ${grandes.map((g) => g.nome).join(", ")} para desenhar miniatura`,
        );
      }
      if (total > par.teto) {
        anotar("média", par.tela, `baixou ${total} kB de imagem ao abrir (teto: ${par.teto} kB)`);
      }
    }
  } finally {
    await navegador.close();
  }

  return { achados, resumo: "URLs e peso das listas conferidos", detalhe };
}

/** Abre a tela, rola até o fim e devolve as imagens que ela pediu ao Storage. */
async function oQueATelaBaixa(navegador, sessao, rota) {
  const contexto = await navegador.newContext({ viewport: { width: 412, height: 915 } });
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
  const baixadas = [];
  pagina.on("response", async (resposta) => {
    if (!resposta.url().includes("firebasestorage")) return;
    /*
     * Só download de arquivo que chegou até o fim.
     *
     * Requisição cancelada — o teste rola a página depressa, e o navegador
     * desiste do que saiu da tela — chega aqui sem corpo e com endereço que
     * não dá para decompor. O nome saía vazio, vazio não termina em `-mini`, e
     * a verificação acusava "baixou a imagem grande de " com o nome em branco.
     * Teste que acusa sozinho é pior que teste nenhum: ensina a ignorar.
     */
    if (resposta.status() !== 200) return;
    const depoisDoO = resposta.url().split("/o/")[1];
    if (!depoisDoO) return;
    const corpo = await resposta.body().catch(() => null);
    if (!corpo) return;
    const nome = decodeURIComponent(depoisDoO.split("?")[0]).split("/").pop();
    if (!nome) return;
    baixadas.push({ nome, kb: Math.round(corpo.length / 1024) });
  });

  await pagina.goto(SITE + rota, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await pagina.waitForFunction(() => document.body.innerText.trim().length > 40, null, { timeout: 15000 }).catch(() => {});
  // As imagens são preguiçosas: só pedem quando chegam perto da tela.
  await pagina.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await pagina.waitForTimeout(2500);

  await contexto.close();
  return baixadas;
}
