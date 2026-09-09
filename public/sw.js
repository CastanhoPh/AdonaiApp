/*
 * Service worker do AdonaiApp.
 *
 * Faz duas coisas:
 *  1. existe com um manipulador de `fetch`, que é o que o Chrome exige para
 *     oferecer a instalação na tela de início;
 *  2. recebe os push do Firebase Cloud Messaging e mostra a notificação.
 *
 * Não guarda cache: leitura offline do roteiro está na lista de evoluções do
 * briefing e vai exigir versionamento próprio. Guardar respostas aqui, sem
 * isso, deixaria o elenco lendo roteiro desatualizado.
 *
 * O push é tratado direto pelo evento padrão da Web Push API, sem o SDK do
 * Firebase dentro do worker: o FCM entrega um payload com `notification` e
 * `data`, e assim não é preciso duplicar a configuração do projeto aqui nem
 * registrar um segundo service worker só para mensagens.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Repasse para a rede: nenhuma resposta é interceptada nem guardada.
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
