#!/usr/bin/env node
/**
 * Conserta os arquivos de pré-carregamento do roteador quando o build roda no
 * Windows.
 *
 * O roteador do Next pede cada segmento de rota por um nome achatado com
 * pontos — `/admin/__next.admin.__PAGE__.txt`. Quem gera esse nome no export é
 * `convertSegmentPathToStaticExportFilename`, que troca `/` por `.`. Mas a
 * lista de segmentos vem de `path.relative`, que no Windows devolve
 * contrabarras: `admin\pessoas\__PAGE__.segment.rsc`. O replace só pega a barra
 * inicial, e o `path.join` seguinte lê as contrabarras que sobraram como
 * separador de diretório. O resultado é uma pasta
 * `out/admin/pessoas/__next.admin/pessoas/__PAGE__.txt` onde deveria haver o
 * arquivo `out/admin/pessoas/__next.admin.pessoas.__PAGE__.txt`.
 *
 * Como o nome pedido não existe, todo pré-carregamento responde 404 e o
 * roteador navega sem nada aquecido. Rotas de um único segmento
 * (`__next._tree.txt`, `__next._full.txt`) escapam do bug porque não têm
 * contrabarra nenhuma.
 *
 * É bug do Next, não do projeto: em Linux (Vercel, CI) o export sai correto.
 * Por isso a correção mora aqui, no pós-build, em vez de num patch em
 * `node_modules` que `npm ci` desfaria.
 *
 * O script **copia**; a árvore aninhada fica onde está. São 54 arquivos de
 * poucos KB, e copiar em vez de mover evita apagar qualquer coisa que o
 * roteador ainda possa pedir pela forma antiga.
 */
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..", "out");
const PREFIXO = "__next.";

/** Todos os arquivos abaixo de `dir`, como caminhos relativos a ele. */
async function arquivosDe(dir) {
  const achados = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      const dentro = await arquivosDe(join(dir, item.name));
      achados.push(...dentro.map((p) => `${item.name}/${p}`));
    } else {
      achados.push(item.name);
    }
  }
  return achados;
}

/**
 * Procura diretórios `__next.*` — que só existem por causa do bug — e grava ao
 * lado deles o arquivo achatado que o roteador realmente pede.
 */
async function percorrer(dir, relatorio) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const caminho = join(dir, item.name);

    if (!item.name.startsWith(PREFIXO)) {
      await percorrer(caminho, relatorio);
      continue;
    }

    // `out/admin/pessoas/__next.admin` + `pessoas/__PAGE__.txt`
    //   → `out/admin/pessoas/__next.admin.pessoas.__PAGE__.txt`
    for (const relativo of await arquivosDe(caminho)) {
      const achatado = `${item.name}.${relativo.split("/").join(".")}`;
      const destino = join(dir, achatado);
      await mkdir(dirname(destino), { recursive: true });
      await copyFile(join(caminho, relativo), destino);
      relatorio.push(destino.slice(raiz.length + 1).replaceAll("\\", "/"));
    }
  }
}

if (!existsSync(raiz)) {
  console.error("A pasta out/ não existe. Rode o build antes deste script.");
  process.exit(1);
}

const relatorio = [];
await percorrer(raiz, relatorio);

if (relatorio.length === 0) {
  // Esperado em Linux/macOS: o export já grava os nomes certos.
  console.log("Segmentos de pré-carregamento já estavam corretos; nada a fazer.");
} else {
  let bytes = 0;
  for (const p of relatorio) bytes += (await stat(join(raiz, p))).size;
  console.log(`${relatorio.length} segmentos achatados (${(bytes / 1024).toFixed(1)} KB):`);
  for (const p of relatorio.sort()) console.log(`  /${p}`);
}
