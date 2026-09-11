#!/usr/bin/env node
/**
 * Gera o convite de primeiro acesso de alguém do cadastro.
 *
 * É o mesmo convite da tela Pessoas do aplicativo; existe aqui porque a maior
 * parte do grupo entrou pelo acervo e ainda não tem acesso, e mandar os links
 * um a um pelo terminal é mais rápido do que abrir ficha por ficha.
 *
 * O código já vem ligado à ficha, então quem resgata entra com o histórico, os
 * personagens e as convocações no lugar — e a direção não precisa adivinhar
 * depois de quem era aquele e-mail.
 *
 *   node scripts/convite.mjs "Sarah Thomazi"
 *   node scripts/convite.mjs "Sarah Thomazi" --novo    ignora convite em aberto
 *
 * Recusa quando a pessoa já tem conta, e mostra o convite existente em vez de
 * criar um segundo — dois códigos válidos para a mesma ficha só servem para
 * confundir quem recebe.
 */
import { db } from "./firebase-admin-app.mjs";
import { gerarCodigo, formatarCodigo, linkDoConvite } from "../src/lib/convite.ts";

const DIAS_DE_VALIDADE = 7;

const alvo = (process.argv[2] ?? "").trim();
const forcarNovo = process.argv.includes("--novo");

if (!alvo) {
  console.error('\n  Informe o nome: node scripts/convite.mjs "Sarah Thomazi"\n');
  process.exit(1);
}

const normalizar = (n) =>
  String(n ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ------------------------------------------------------------- a pessoa
const pessoas = (await db.collection("people").get()).docs;
const exatos = pessoas.filter((d) => normalizar(d.data().nome) === normalizar(alvo));
const parciais = pessoas.filter((d) => normalizar(d.data().nome).includes(normalizar(alvo)));
const achados = exatos.length ? exatos : parciais;

if (achados.length === 0) {
  console.error(`\n  Ninguém no cadastro com "${alvo}".\n`);
  process.exit(1);
}
if (achados.length > 1) {
  console.error(`\n  "${alvo}" casa com mais de uma pessoa. Seja mais específico:`);
  achados.forEach((d) => console.error(`     ${d.data().nome}`));
  console.error("");
  process.exit(1);
}

const pessoa = achados[0];
const dados = pessoa.data();
console.log(`\n  ${dados.nome}`);
console.log(`  ficha people/${pessoa.id}`);

// -------------------------------------------------------- já tem acesso?
const contas = await db.collection("users").where("personId", "==", pessoa.id).limit(1).get();
if (!contas.empty) {
  const c = contas.docs[0].data();
  console.error(`\n  Esta pessoa já tem acesso: ${c.email} (${c.role}).`);
  console.error("  Se ela perdeu a senha, use “Esqueci minha senha” na tela de entrar.\n");
  process.exit(1);
}

const participacoes = (
  await db.collection("participations").where("personId", "==", pessoa.id).get()
).size;
console.log(`  ${participacoes} participação(ões) no histórico, que aparecem no primeiro acesso`);

// ------------------------------------------------ convite já em aberto?
const agora = new Date().toISOString();
const existentes = (await db.collection("convites").where("personId", "==", pessoa.id).get()).docs;
const emAberto = existentes.find((d) => !d.data().usadoEm && d.data().expiraEm > agora);

if (emAberto && !forcarNovo) {
  const v = emAberto.data();
  console.log(`\n  Já existe um convite em aberto — este é o link dela:\n`);
  console.log(`  Código: ${formatarCodigo(v.codigo)}`);
  console.log(`  Link:   ${linkDoConvite(v.codigo)}`);
  console.log(`\n  Vale até ${v.expiraEm.slice(0, 10)}. Use --novo para gerar outro e invalidar`);
  console.log("  este (o antigo continua valendo até você apagá-lo em Pessoas).\n");
  process.exit(0);
}

// ------------------------------------------------------------- o convite
const expira = new Date();
expira.setDate(expira.getDate() + DIAS_DE_VALIDADE);

let codigo = null;
for (let tentativa = 0; tentativa < 5 && !codigo; tentativa++) {
  const candidato = gerarCodigo();
  // O id do documento é o próprio código: conferir antes evita passar por cima
  // do convite de outra pessoa numa colisão, que o cliente trata pela regra.
  if (!(await db.collection("convites").doc(candidato).get()).exists) codigo = candidato;
}
if (!codigo) {
  console.error("\n  Não consegui um código livre. Rode de novo.\n");
  process.exit(1);
}

await db.collection("convites").doc(codigo).set({
  codigo,
  personId: pessoa.id,
  personNome: dados.nome,
  criadoPor: "scripts/convite.mjs",
  criadoEm: agora,
  expiraEm: expira.toISOString(),
  usadoEm: null,
  usadoPor: null,
});

console.log("\n  Convite criado.\n");
console.log(`  Código: ${formatarCodigo(codigo)}`);
console.log(`  Link:   ${linkDoConvite(codigo)}`);
console.log(`\n  Vale até ${expira.toISOString().slice(0, 10)} e serve uma vez só.`);
console.log("  Ao abrir, ela escolhe o e-mail e a senha; o nome vem preenchido da ficha.\n");
process.exit(0);
