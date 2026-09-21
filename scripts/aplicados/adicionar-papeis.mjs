#!/usr/bin/env node
/**
 * Acrescenta papéis a peças já cadastradas.
 *
 * O acervo entrou de listas escritas de memória, então papel esquecido vai
 * aparecendo com o tempo. Este script existe para esses acréscimos: ele
 * **adiciona**, nunca refaz o elenco. Refazer significaria apagar personagem e
 * participação para recriar iguais, e apagar histórico para reescrever o mesmo
 * conteúdo é risco sem ganho.
 *
 * Cada papel entra em dois lugares, num único lote: o personagem, em
 * `plays/{id}/characters/{id}`, e a participação, que é o que faz a peça
 * aparecer no histórico da pessoa. Um sem o outro deixaria o papel visível na
 * peça e invisível no perfil de quem o fez — ou o contrário.
 *
 * Idempotente: papel de mesmo nome já existente na peça é pulado. `ordem` é
 * calculada como a próxima livre, então o acréscimo não renumera ninguém.
 *
 *   node scripts/adicionar-papeis.mjs            confere
 *   node scripts/adicionar-papeis.mjs --aplicar  grava
 */
import { db } from "../firebase-admin-app.mjs";

import { jaRodou } from "./ja-rodou.mjs";

jaRodou("", "acrescentou papéis que faltavam em peças do acervo");

const TIPO = {
  Principal: "protagonista",
  Antagonista: "antagonista",
  "Participação Especial": "especial",
  Narrador: "narrador",
  Figurante: "figurante",
};

const PAPEIS = [
  {
    peca: "Além do Céu Azul",
    personagem: "Apresentador",
    pessoa: "Celine Mocarzel",
    tipo: "Participação Especial",
  },
];

const aplicar = process.argv.includes("--aplicar");
console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

const pecas = await db.collection("plays").get();
const pecaPorTitulo = new Map(pecas.docs.map((d) => [d.data().titulo, d]));

const pessoas = await db.collection("people").get();
const pessoaPorNome = new Map(pessoas.docs.map((d) => [d.data().nome, d]));

let aGravar = 0;
for (const item of PAPEIS) {
  const rotulo = `${item.peca} › ${item.personagem}`;

  const peca = pecaPorTitulo.get(item.peca);
  if (!peca) {
    console.log(`  ${rotulo}\n     PULA — peça não encontrada`);
    continue;
  }
  const pessoa = pessoaPorNome.get(item.pessoa);
  if (!pessoa) {
    console.log(`  ${rotulo}\n     PULA — pessoa "${item.pessoa}" não cadastrada`);
    continue;
  }
  const tipoPapel = TIPO[item.tipo];
  if (!tipoPapel) throw new Error(`Tipo de papel desconhecido: "${item.tipo}"`);

  const existentes = await peca.ref.collection("characters").get();
  const jaTem = existentes.docs.find((d) => d.data().nome === item.personagem);
  if (jaTem) {
    const dele = jaTem.data();
    console.log(
      `  ${rotulo}\n     PULA — já existe, com ${dele.personNome || "ninguém"} (${dele.tipoPapel})`,
    );
    continue;
  }

  // Próxima ordem livre: acrescentar não deve renumerar quem já está lá.
  const ordem = existentes.docs.reduce((maior, d) => Math.max(maior, d.data().ordem ?? -1), -1) + 1;
  const dadosPeca = peca.data();

  console.log(`  ${rotulo}`);
  console.log(`     ${item.pessoa} · ${tipoPapel} · ordem ${ordem}`);
  console.log(`     ${dadosPeca.nomeEvento || "sem evento"} · ${dadosPeca.dataApresentacao}`);
  aGravar++;

  if (!aplicar) continue;

  const lote = db.batch();
  const personagemRef = peca.ref.collection("characters").doc();
  lote.set(personagemRef, {
    playId: peca.id,
    nome: item.personagem,
    descricao: "",
    tipoPapel,
    observacoes: "",
    imagemUrl: "",
    personId: pessoa.id,
    personNome: pessoa.data().nome,
    situacao: "confirmado",
    ordem,
  });
  lote.set(db.collection("participations").doc(), {
    personId: pessoa.id,
    playId: peca.id,
    playTitulo: dadosPeca.titulo,
    playEvento: dadosPeca.nomeEvento ?? "",
    playCapaUrl: dadosPeca.capaUrl ?? "",
    characterId: personagemRef.id,
    characterNome: item.personagem,
    tipoPapel,
    periodo: dadosPeca.dataApresentacao,
    concluidaEm: new Date().toISOString(),
  });
  await lote.commit();
  console.log("     gravado");
}

console.log(`\n  ${aGravar} papel(éis) ${aplicar ? "gravado(s)" : "a gravar"}`);
if (!aplicar && aGravar > 0) console.log("\n  Rode de novo com --aplicar para gravar.\n");
process.exit(0);
