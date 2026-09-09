#!/usr/bin/env node
/**
 * Sobe o acervo de peças já apresentadas.
 *
 * Só nome, evento e data — sem personagens e sem roteiro. O elenco entra
 * depois, pela tela da peça; registrar o que se sabe hoje já vale, e esperar
 * lembrar de tudo é o que mantém o acervo fora do app.
 *
 * As peças nascem com status "concluida" e `atual: false`: já aconteceram, e
 * apenas uma peça pode ser a atual do teatro.
 *
 * Idempotente: identifica pela dupla título + data, então rodar duas vezes não
 * duplica nada. Confere por padrão; grava só com --aplicar.
 *
 *   node scripts/subir-pecas-antigas.mjs
 *   node scripts/subir-pecas-antigas.mjs --aplicar
 */
import { db } from "./firebase-admin-app.mjs";

/*
 * Lista como recebida, na ordem em que foi passada.
 *
 * "Páscoa" saiu sem acento na lista original e foi cadastrada assim; a correção
 * veio depois, confirmada, e está refletida aqui. As datas de abril de 2026
 * ficam como recebidas: "Paçoca no Avalanche" em 25/04 e "Quem Deus Diz que
 * Somos II" em 11/04, mesmo aparecendo na ordem inversa na lista — foi
 * confirmado que estão certas.
 */
const PECAS = [
  { titulo: "Ele É", evento: "Páscoa 2024", data: "31/03/2024" },
  { titulo: "José no Egito", evento: "Convenção 2024", data: "13/07/2024" },
  { titulo: "Jardim Secreto", evento: "Rede Mil 2024", data: "19/10/2024" },
  { titulo: "Filho Pródigo", evento: "Culto de Colheita", data: "16/02/2025" },
  { titulo: "A Recompensa", evento: "Páscoa 2025", data: "20/04/2025" },
  { titulo: "Nascimento de Jesus", evento: "Convenção 2025", data: "18/07/2025" },
  { titulo: "Além do Céu Azul", evento: "Rede Mil 2025", data: "12/10/2025" },
  { titulo: "Quem Deus Diz que Somos I", evento: "Encontro 2025", data: "26/10/2025" },
  { titulo: "A Resposta", evento: "Natal 2025", data: "22/12/2025" },
  { titulo: "Está Consumado", evento: "Páscoa 2026", data: "05/04/2026" },
  { titulo: "Paçoca no Avalanche", evento: "10 Anos de Avalanche", data: "25/04/2026" },
  { titulo: "Quem Deus Diz que Somos II", evento: "Encontro 2026 I", data: "11/04/2026" },
  { titulo: "Quem Deus Diz que Somos III", evento: "Encontro 2026 II", data: "03/07/2026" },
];

const aplicar = process.argv.includes("--aplicar");

/** "31/03/2024" → "2024-03-31", que é o formato usado no banco. */
function paraISO(brasileira) {
  const [dia, mes, ano] = brasileira.split("/");
  return `${ano}-${mes}-${dia}`;
}

const hoje = new Date().toISOString().slice(0, 10);
const existentes = await db.collection("plays").get();
const jaTem = new Set(existentes.docs.map((d) => `${d.data().titulo}|${d.data().dataApresentacao}`));

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);
console.log(`  ${PECAS.length} peças na lista · ${existentes.size} já no banco\n`);

const aCriar = [];
for (const peca of PECAS) {
  const data = paraISO(peca.data);
  const problemas = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) problemas.push("data inválida");
  if (data > hoje) problemas.push("data no futuro");
  if (jaTem.has(`${peca.titulo}|${data}`)) problemas.push("já cadastrada");

  const marca = problemas.length ? `PULA (${problemas.join("; ")})` : "criar";
  console.log(`  ${data}  ${peca.titulo.padEnd(30)} ${peca.evento.padEnd(22)} ${marca}`);
  if (problemas.length === 0) aCriar.push({ ...peca, data });
}

console.log(`\n  ${aCriar.length} a criar, ${PECAS.length - aCriar.length} puladas`);

if (!aplicar) {
  console.log("\n  Rode de novo com --aplicar para gravar.\n");
  process.exit(0);
}
if (aCriar.length === 0) {
  console.log("\n  Nada a fazer.\n");
  process.exit(0);
}

// Um lote só: ou o acervo inteiro entra, ou nada entra.
const lote = db.batch();
const agora = new Date().toISOString();
for (const peca of aCriar) {
  lote.set(db.collection("plays").doc(), {
    titulo: peca.titulo,
    nomeEvento: peca.evento,
    descricao: "",
    capaUrl: "",
    dataApresentacao: peca.data,
    local: "",
    status: "concluida",
    atual: false,
    roteiroVersao: 0,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: agora,
  });
}
await lote.commit();
console.log(`\n  ${aCriar.length} peças gravadas.`);

const depois = await db.collection("plays").get();
console.log(`  total de peças no banco: ${depois.size}\n`);
process.exit(0);
