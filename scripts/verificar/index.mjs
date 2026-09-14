#!/usr/bin/env node
/**
 * Verifica o AdonaiApp de ponta a ponta, contra o que está no ar.
 *
 *   npm run verificar                 tudo
 *   npm run verificar -- dados        só uma parte (dados, permissoes, telas, imagens)
 *   npm run verificar -- --detalhe    mostra linha por linha, não só o resumo
 *
 * ## Por que testa a produção
 *
 * Não há emulador aqui de propósito. As três coisas que já quebraram de
 * verdade neste projeto — uma regra do Firestore recusando uma gravação
 * legítima, uma URL de imagem apontando para arquivo inexistente, uma tela
 * abrindo em branco por falta de permissão — só acontecem com as regras
 * publicadas, os dados reais e o site publicado. Emulador teria passado nas
 * três.
 *
 * O preço disso é uma regra rígida: **nada aqui escreve em dado de ninguém.**
 * As verificações leem, e as gravações que tentam são as que devem falhar —
 * gravação negada não muda nada. O único ponto que precisa de uma gravação
 * de fato diferente lê o valor antes e o devolve depois, num `finally`.
 *
 * ## Código de saída
 *
 * 0 quando não há achado de gravidade alta, 1 quando há. Média e baixa
 * aparecem no relatório e não reprovam: são coisas para resolver, não para
 * impedir uma publicação.
 */
import { imprimirAchados } from "./relatorio.mjs";
import * as dados from "./dados.mjs";
import * as permissoes from "./permissoes.mjs";
import * as telas from "./telas.mjs";
import * as imagens from "./imagens.mjs";
import { SITE } from "./ambiente.mjs";

/* A ordem é a do custo: o que é rápido e só lê vem antes de abrir navegador. */
const VERIFICACOES = [dados, permissoes, imagens, telas];

const argumentos = process.argv.slice(2);
const detalhado = argumentos.includes("--detalhe");
const escolhidas = argumentos.filter((a) => !a.startsWith("--"));

const aRodar = escolhidas.length
  ? VERIFICACOES.filter((v) => escolhidas.includes(v.nome))
  : VERIFICACOES;

if (aRodar.length === 0) {
  console.error(`\n  Não conheço: ${escolhidas.join(", ")}`);
  console.error(`  Disponíveis: ${VERIFICACOES.map((v) => v.nome).join(", ")}\n`);
  process.exit(2);
}

console.log(`\n  Verificando ${SITE}\n`);

const todos = [];
let quebrou = false;

for (const verificacao of aRodar) {
  const inicio = Date.now();
  process.stdout.write(`  ${verificacao.titulo}… `);

  let resultado;
  try {
    resultado = await verificacao.rodar();
  } catch (erro) {
    quebrou = true;
    console.log("não rodou");
    console.log(`     ${erro.message}\n`);
    continue;
  }

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  const altas = resultado.achados.filter((a) => a.gravidade === "alta").length;
  const outros = resultado.achados.length - altas;
  const veredito =
    resultado.achados.length === 0
      ? "ok"
      : altas > 0
        ? `${altas} grave(s)${outros ? ` e mais ${outros}` : ""}`
        : `${outros} para olhar`;

  console.log(`${veredito}  (${segundos}s)`);
  if (resultado.resumo) console.log(`     ${resultado.resumo}`);
  if (detalhado && resultado.detalhe) {
    for (const linha of resultado.detalhe) console.log(`     ${linha}`);
  }
  if (resultado.achados.length > 0) imprimirAchados(resultado.achados);
  console.log("");

  todos.push(...resultado.achados);
}

const graves = todos.filter((a) => a.gravidade === "alta").length;

if (quebrou) {
  console.log("  Alguma verificação não chegou a rodar — o resultado está incompleto.\n");
  process.exit(2);
}
if (graves > 0) {
  console.log(`  ${graves} problema(s) grave(s). Não publique assim.\n`);
  process.exit(1);
}
if (todos.length > 0) {
  console.log(`  Nada grave. ${todos.length} ponto(s) para olhar quando der.\n`);
  process.exit(0);
}
console.log("  Tudo conforme.\n");
process.exit(0);
