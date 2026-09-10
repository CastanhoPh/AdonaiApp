/**
 * Leitura de links do YouTube.
 *
 * A direção cola o link como o YouTube entrega, e ele vem de várias formas
 * dependendo de onde foi copiado: o endereço da barra, o "Compartilhar" do
 * celular, um Short. Guardar o link cru e interpretar na hora de mostrar é o
 * que permite aceitar todas sem pedir para ninguém editar nada.
 */

/** Os onze caracteres que identificam o vídeo. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrai o id do vídeo, ou nulo se não reconhecer.
 *
 * Cobre as formas que aparecem na prática:
 *   youtube.com/watch?v=ID          barra do navegador
 *   youtu.be/ID                     botão Compartilhar
 *   youtube.com/shorts/ID           vídeo curto
 *   youtube.com/embed/ID            incorporado
 *   youtube.com/live/ID             transmissão
 */
export function idDoYoutube(link: string): string | null {
  const bruto = link.trim();
  if (!bruto) return null;

  /*
   * O id solto vem primeiro. Depois seria tarde: `new URL("https://" + id)` é
   * um endereço perfeitamente válido — o id vira o nome do servidor —, então o
   * `catch` nunca dispararia e o id seria descartado por não ser do YouTube.
   */
  if (ID.test(bruto)) return bruto;

  // Sem esquema o construtor de URL recusa, e é comum colar assim.
  const comEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;

  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const partes = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const candidato = partes[0] ?? "";
    return ID.test(candidato) ? candidato : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const doParametro = url.searchParams.get("v");
    if (doParametro && ID.test(doParametro)) return doParametro;
    if (["shorts", "embed", "live", "v"].includes(partes[0] ?? "")) {
      const candidato = partes[1] ?? "";
      return ID.test(candidato) ? candidato : null;
    }
  }

  return null;
}

export function ehLinkDoYoutube(link: string): boolean {
  return idDoYoutube(link) !== null;
}

/**
 * Capa do vídeo.
 *
 * `mqdefault` existe para todo vídeo, inclusive os antigos; as resoluções
 * maiores faltam em parte do acervo do YouTube e apareceriam como imagem
 * quebrada.
 */
export function capaDoYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** Endereço normalizado, para abrir sempre do mesmo jeito. */
export function linkDoVideo(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
