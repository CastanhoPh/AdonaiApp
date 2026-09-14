#!/usr/bin/env node
/**
 * Devolve ao ar o que uma cópia guardou.
 *
 *   node scripts/restaurar.mjs <pasta>            confere e mostra o que mudaria
 *   node scripts/restaurar.mjs <pasta> --aplicar  grava
 *   node scripts/restaurar.mjs <pasta> --so people,plays
 *
 * **Não apaga nada.** Escreve o que está na cópia; o que existe hoje e não
 * está nela fica onde está, e aparece na lista de "a mais" para você decidir.
 * Restauração é o momento de mais pressa e menos calma de todos, e é o pior
 * momento possível para um script decidir sozinho que algo é lixo.
 *
 * Também não é a primeira coisa a tentar. Se o problema for um campo errado em
 * um documento, corrija o documento. Isto aqui é para quando sumiu.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "./firebase-admin-app.mjs";
import { lerEnv } from "./verificar/ambiente.mjs";

const env = lerEnv();
const bucket = getStorage().bucket(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes("--aplicar");
const pasta = resolve(argumentos.find((a) => !a.startsWith("--")) ?? "");
const filtro = (() => {
  const i = argumentos.indexOf("--so");
  return i !== -1 && argumentos[i + 1] ? argumentos[i + 1].split(",") : null;
})();

if (!pasta || !existsSync(join(pasta, "banco.json"))) {
  console.error("\n  Informe a pasta de uma cópia (a que tem banco.json).\n");
  console.error("  node scripts/restaurar.mjs ../AdonaiApp-backups/2026-09-14-1508\n");
  process.exit(2);
}

/*
 * A contagem de tentativas do convite não volta.
 *
 * São contadores de minutos atrás. Restaurá-los não recupera nada e ainda
 * poderia deixar alguém barrado por um limite que já tinha passado.
 */
const NAO_RESTAURA = new Set(["limites"]);

const banco = JSON.parse(readFileSync(join(pasta, "banco.json"), "utf8"));
const catalogo = existsSync(join(pasta, "arquivos.json"))
  ? JSON.parse(readFileSync(join(pasta, "arquivos.json"), "utf8"))
  : [];

console.log(`\n  Cópia: ${pasta}`);
console.log(`  ${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

/** Devolve as datas que o backup guardou como texto ao tipo do Firestore. */
function doJson(valor) {
  if (Array.isArray(valor)) return valor.map(doJson);
  if (valor && typeof valor === "object") {
    if (typeof valor.__data === "string") return Timestamp.fromDate(new Date(valor.__data));
    return Object.fromEntries(Object.entries(valor).map(([c, v]) => [c, doJson(v)]));
  }
  return valor;
}

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let novos = 0;
let mudados = 0;
let identicos = 0;
const aMais = [];

/** Percorre a árvore da cópia comparando com o que está no ar. */
async function restaurarColecao(referencia, documentos, caminho) {
  const noAr = new Set((await referencia.listDocuments()).map((r) => r.id));

  for (const [id, guardado] of Object.entries(documentos)) {
    const ref = referencia.doc(id);
    noAr.delete(id);

    if (guardado.dados) {
      const atual = await ref.get();
      const dados = doJson(guardado.dados);
      if (!atual.exists) {
        novos++;
        console.log(`  + ${caminho}/${id}`);
        if (aplicar) await ref.set(dados);
      } else if (!iguais(JSON.parse(JSON.stringify(atual.data())), JSON.parse(JSON.stringify(dados)))) {
        mudados++;
        const campos = Object.keys(dados).filter((c) => !iguais(atual.data()[c], dados[c]));
        console.log(`  ~ ${caminho}/${id}  (${campos.join(", ") || "—"})`);
        // `set` sem merge: a cópia é a verdade, inclusive nos campos que
        // passaram a existir depois dela e que a restauração deve remover.
        if (aplicar) await ref.set(dados);
      } else {
        identicos++;
      }
    }

    for (const [nome, dentro] of Object.entries(guardado.subcolecoes ?? {})) {
      await restaurarColecao(ref.collection(nome), dentro, `${caminho}/${id}/${nome}`);
    }
  }

  for (const id of noAr) aMais.push(`${caminho}/${id}`);
}

for (const [colecao, documentos] of Object.entries(banco)) {
  if (NAO_RESTAURA.has(colecao)) continue;
  if (filtro && !filtro.includes(colecao)) continue;
  await restaurarColecao(db.collection(colecao), documentos, colecao);
}

console.log(
  `\n  banco: ${novos} a criar · ${mudados} a sobrescrever · ${identicos} já iguais`,
);
if (aMais.length > 0) {
  console.log(`\n  ${aMais.length} documento(s) existem hoje e não estão na cópia — não serão tocados:`);
  aMais.slice(0, 20).forEach((c) => console.log(`     ${c}`));
  if (aMais.length > 20) console.log(`     ... e mais ${aMais.length - 20}`);
}

/* --------------------------------------------------------------- arquivos */

if (!filtro) {
  let faltando = 0;
  let presentes = 0;
  for (const item of catalogo) {
    const origem = join(pasta, "arquivos", item.caminho);
    if (!existsSync(origem)) continue;
    const arquivo = bucket.file(item.caminho);
    if ((await arquivo.exists())[0]) {
      presentes++;
      continue;
    }
    faltando++;
    console.log(`  + arquivo ${item.caminho}`);
    if (aplicar) {
      await arquivo.save(readFileSync(origem), {
        contentType: item.tipo ?? "image/jpeg",
        metadata: {
          cacheControl: item.cacheControl ?? "public, max-age=31536000",
          /*
           * O mesmo token de antes. O endereço gravado no Firestore carrega
           * esse token; com um novo, toda ficha apontaria para o nada.
           */
          ...(item.token ? { metadata: { firebaseStorageDownloadTokens: item.token } } : {}),
        },
      });
    }
  }
  console.log(`\n  arquivos: ${faltando} a repor · ${presentes} já no lugar`);
}

if (aplicar) {
  console.log("\n  Rode `npm run verificar` para conferir como ficou.\n");
} else if (novos + mudados > 0) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
} else {
  console.log("\n  Nada a fazer: o que está no ar já é o que a cópia guardou.\n");
}
process.exit(0);
