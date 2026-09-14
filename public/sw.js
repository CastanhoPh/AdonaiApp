/*
 * Service worker do AdonaiApp.
 *
 * Faz três coisas:
 *
 *  1. guarda a casca do aplicativo, para ele abrir sem rede;
 *  2. existe com um manipulador de `fetch`, que é o que o Chrome exige para
 *     oferecer a instalação na tela de início;
 *  3. recebe os push do Firebase Cloud Messaging e mostra a notificação.
 *
 * Sobre guardar cache — a versão anterior não guardava nada, com o argumento
 * de que o elenco não pode ler roteiro desatualizado. O argumento continua de
 * pé, e é por isso que **nenhum dado** passa por aqui: Firestore, Storage e
 * YouTube são de outra origem e seguem direto para a rede, sempre. O que fica
 * guardado é só o programa — o HTML e o JavaScript —, e ele não tem idade:
 * mostra o que o Firestore responder na hora.
 *
 * Sem isso, abrir o app dependia de o HTML ainda estar no cache do navegador,
 * que vale uma hora. Passada a hora, sem sinal, não abria. E o ginásio do
 * ensaio é justamente onde o sinal falta.
 */

const CACHE = "adonai-casca-v1";

/*
 * As telas do elenco entram já na instalação, não na primeira visita.
 *
 * Quem instala o app costuma abrir o Início; se só o que foi visitado ficasse
 * guardado, as outras abas falhariam no primeiro ensaio sem sinal. São poucos
 * kB de HTML cada uma. Os endereços da direção ficam de fora de propósito: a
 * direção trabalha sentada, com sinal, e não vale ocupar espaço no aparelho de
 * quem nunca vai abrir aquilo.
 */
const TELAS_DO_ELENCO = ["/", "/inicio", "/roteiro", "/ensaios", "/exercicios", "/perfil", "/historico", "/personagem"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Uma a uma: se um endereço falhar, os outros ainda entram. `addAll`
      // desiste de tudo no primeiro erro.
      await Promise.all(
        TELAS_DO_ELENCO.map((rota) => cache.add(rota).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Versão nova do worker joga fora a casca da versão anterior.
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/*
 * Teto de itens guardados.
 *
 * Os arquivos de `/_next/static/` têm hash no nome, então cada publicação
 * acrescenta um conjunto novo e os antigos nunca deixam de existir — ninguém
 * pede por eles de novo, mas eles ficam. Uns 350 kB por publicação não é
 * nada num dia e é bastante num ano. O teto corta os mais antigos, que é a
 * ordem em que `keys()` devolve.
 */
const TETO = 120;

async function podar(cache) {
  const chaves = await cache.keys();
  if (chaves.length <= TETO) return;
  // Mantém as telas: elas são poucas e são o que faz o app abrir sem rede.
  const descartaveis = chaves.filter((r) => new URL(r.url).pathname.startsWith("/_next/static/"));
  const sobrando = chaves.length - TETO;
  await Promise.all(descartaveis.slice(0, sobrando).map((r) => cache.delete(r)));
}

/** Guarda a resposta se ela valer a pena. Erro e resposta opaca, não. */
async function guardar(requisicao, resposta) {
  if (!resposta || !resposta.ok || resposta.type === "opaque") return resposta;
  const cache = await caches.open(CACHE);
  await cache.put(requisicao, resposta.clone());
  await podar(cache);
  return resposta;
}

/**
 * Para o que nunca muda de conteúdo.
 *
 * Os arquivos de `/_next/static/` têm o hash do conteúdo no nome: se o nome é
 * o mesmo, o conteúdo é o mesmo. Então o cache é resposta final, e nem vale
 * perguntar à rede.
 */
async function doCachePrimeiro(requisicao) {
  const guardado = await caches.match(requisicao);
  if (guardado) return guardado;
  const daRede = await fetch(requisicao);
  return guardar(requisicao, daRede);
}

/**
 * Para o HTML.
 *
 * Rede primeiro, porque uma versão nova do app tem de chegar assim que
 * existir. O cache é rede de segurança: só entra quando a rede não responde.
 */
async function daRedeComReserva(requisicao) {
  try {
    return await guardar(requisicao, await fetch(requisicao));
  } catch {
    const guardado = await caches.match(requisicao);
    if (guardado) return guardado;
    /*
     * Endereço que nunca foi aberto e não está guardado. Sem rede não há como
     * inventar: devolve o erro, e o navegador mostra a própria tela de sem
     * conexão. Servir o HTML de outra tela deixaria a barra de endereço
     * dizendo uma coisa e a tela mostrando outra.
     */
    throw new Error("sem rede e sem cópia guardada");
  }
}

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  /*
   * Só o que é servido por este site. Firestore, Storage e as capas do YouTube
   * são de outra origem e passam direto — é o dado, e dado velho aqui seria
   * exatamente o defeito que se quer evitar.
   */
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(doCachePrimeiro(requisicao));
    return;
  }

  if (requisicao.mode === "navigate") {
    evento.respondWith(daRedeComReserva(requisicao));
    return;
  }

  // Ícones, manifesto e as imagens da marca: mudam raramente, e a rede
  // primeiro com reserva mantém tudo coerente sem custo perceptível.
  if (/\.(png|jpg|svg|ico|webmanifest|txt)$/.test(url.pathname)) {
    evento.respondWith(daRedeComReserva(requisicao));
  }
});

self.addEventListener("push", (evento) => {
  let payload = {};
  try {
    payload = evento.data ? evento.data.json() : {};
  } catch {
    payload = { notification: { body: evento.data ? evento.data.text() : "" } };
  }

  const aviso = payload.notification ?? {};
  const dados = payload.data ?? {};
  const titulo = aviso.title || dados.titulo || "AdonaiApp";

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: aviso.body || dados.mensagem || "",
      icon: "/adonai-icon-192.png",
      badge: "/favicon-32.png",
      // Agrupa por ensaio quando houver, para não empilhar avisos repetidos.
      tag: dados.ensaioId || dados.avisoId || "adonai",
      data: { url: dados.url || "/inicio" },
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url || "/inicio";

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Se o app já está aberto, navega na janela existente em vez de abrir outra.
      for (const janela of janelas) {
        if ("focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
