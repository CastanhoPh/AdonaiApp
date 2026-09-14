#!/usr/bin/env node
/**
 * Sobe o elenco de peças já cadastradas.
 *
 * Cria as pessoas que ainda não existem, os personagens de cada peça e as
 * participações — que é o que faz a peça aparecer no histórico de cada um.
 *
 * Um lote por peça: ou o elenco inteiro entra, ou nada entra. Elenco pela
 * metade no histórico é pior que elenco nenhum, porque ninguém percebe o que
 * ficou faltando.
 *
 * Idempotente: peça que já tem personagem é pulada por inteiro, e pessoa é
 * reaproveitada por nome normalizado. Confere por padrão; grava com --aplicar.
 *
 *   node scripts/subir-elenco.mjs
 *   node scripts/subir-elenco.mjs --aplicar
 */
import { db } from "./firebase-admin-app.mjs";

/*
 * Como os rótulos da lista viram tipo de papel no app.
 *
 * "Principal" não existe como tipo; o equivalente é protagonista. E a lista usa
 * "Antagonista" para quase todo papel que não é o principal — inclusive mãe,
 * pai e versão criança da protagonista, que dramaticamente são coadjuvantes.
 * Mantido literal de propósito: é a classificação de quem montou a peça, e
 * reinterpretá-la em silêncio não é meu papel. Trocar para "coadjuvante" é
 * mudar uma linha aqui e rodar de novo.
 */
const TIPO = {
  Principal: "protagonista",
  Antagonista: "antagonista",
  "Participação Especial": "especial",
};

/*
 * Nomes que se referem à mesma pessoa escritos de formas diferentes.
 *
 * Sem isto o acervo ganharia pessoa duplicada e o histórico se dividiria entre
 * duas fichas — o pior defeito possível aqui, porque é silencioso.
 *
 * "Pedro Castanho" é como a lista chama quem está cadastrado como "Pedro
 * Henrique Ferreira Castanho"; "Daniela Golçalves" aparece na peça I e
 * "Daniela Gonçalves" na II.
 */
const MESMA_PESSOA = {
  "pedro castanho": "Pedro Henrique Ferreira Castanho",
  "daniela golcalves": "Daniela Gonçalves",
};

const ELENCOS = [
  {
    peca: "Quem Deus Diz que Somos I",
    papeis: [
      ["Bruna Manzalli", "Amanda", "Principal"],
      ["Letícia Diana", "Amanda Criança", "Antagonista"],
      ["Pedro Castanho", "Ex Namorado da Amanda", "Antagonista"],
      ["Davi Fogaça", "Ex Namorado Recente da Amanda", "Antagonista"],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista"],
      ["Daniela Golçalves", "Mãe da Amanda", "Antagonista"],
      ["Eduarda Reis", "Amiga falsa da Amanda", "Antagonista"],
      ["Sarah Thomazi", "Amiga Crente da Amanda", "Principal"],
      ["Agleston Teruo", "Espírito Santo da Amanda", "Participação Especial"],
    ],
  },
  {
    peca: "Quem Deus Diz que Somos II",
    papeis: [
      ["Bruna Manzalli", "Amanda", "Principal"],
      ["Letícia Diana", "Amanda Criança", "Antagonista"],
      ["Pedro Castanho", "Ex Namorado", "Antagonista"],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista"],
      ["Daniela Gonçalves", "Mãe da Amanda", "Antagonista"],
      ["Julia Alves", "Amiga falsa da Amanda", "Antagonista"],
      ["Sarah Thomazi", "Amiga Crente da Amanda", "Principal"],
      ["Agleston Teruo", "Espírito Santo da Amanda", "Participação Especial"],
      ["Davi Fogaça", "Thiago", "Principal"],
      ["Caio Freitas", "Thiago Criança", "Antagonista"],
      ["Amanda Costa", "Ex Namorada do Thiago", "Antagonista"],
      ["Weslley Ribeiro", "Pai do Thiago", "Antagonista"],
      ["Karina Rocha", "Mãe do Thiago", "Antagonista"],
      ["Pedro Mori", "Amigo Falso do Thiago", "Antagonista"],
      ["Bruno Reis", "Amigo Crente do Thiago", "Principal"],
      ["Luan Oliveira", "Espírito Santo do Thiago", "Participação Especial"],
    ],
  },
  {
    peca: "Quem Deus Diz que Somos III",
    papeis: [
      ["Bruna Manzalli", "Amanda", "Principal"],
      ["Letícia Diana", "Amanda Criança", "Antagonista"],
      ["Pedro Castanho", "Ex Namorado da Amanda", "Antagonista"],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista"],
      ["Amanda Letícia", "Mãe da Amanda", "Antagonista"],
      ["Julia Alves", "Amiga Falsa da Amanda", "Antagonista"],
      ["Bia Batista", "Amiga Crente da Amanda", "Principal"],
      ["Davi Fogaça", "Thiago", "Principal"],
      ["Isac Borel", "Thiago Criança", "Antagonista"],
      ["Tailana Gomes", "Ex Namorada do Thiago", "Antagonista"],
      ["Liu Macedo", "Pai do Thiago", "Antagonista"],
      ["Celine Mocarzel", "Mãe do Thiago", "Antagonista"],
      ["Pedro Mori", "Amigo Falso do Thiago", "Antagonista"],
      ["Bruno Reis", "Amigo Crente do Thiago", "Principal"],
    ],
  },
];

const aplicar = process.argv.includes("--aplicar");

/** Sem acento, minúsculo e com espaços colapsados, só para comparar nomes. */
function normalizar(nome) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve o nome da lista para o nome canônico da pessoa. */
function canonico(nome) {
  const limpo = nome.replace(/\s+/g, " ").trim();
  return MESMA_PESSOA[normalizar(limpo)] ?? limpo;
}

const pecas = await db.collection("plays").get();
const pecaPorTitulo = new Map(pecas.docs.map((d) => [d.data().titulo, d]));

const pessoas = await db.collection("people").get();
const pessoaPorNome = new Map(pessoas.docs.map((d) => [normalizar(d.data().nome ?? ""), d.id]));

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

// ------------------------------------------------------- pessoas envolvidas
const nomesUsados = new Map(); // normalizado → nome canônico
for (const elenco of ELENCOS) {
  for (const [ator] of elenco.papeis) {
    const nome = canonico(ator);
    nomesUsados.set(normalizar(nome), nome);
  }
}

const aCriar = [];
const reaproveitadas = [];
for (const [chave, nome] of nomesUsados) {
  if (pessoaPorNome.has(chave)) reaproveitadas.push(nome);
  else aCriar.push(nome);
}

console.log(`PESSOAS — ${nomesUsados.size} envolvidas no total`);
console.log(`  já cadastradas (${reaproveitadas.length}): ${reaproveitadas.join(", ")}`);
console.log(`  a criar (${aCriar.length}):`);
aCriar.forEach((n) => console.log(`     ${n}`));

// Cria antes das peças: o personagem precisa do id da pessoa.
const idPorNome = new Map(pessoaPorNome);
if (aplicar && aCriar.length > 0) {
  const lote = db.batch();
  const agora = new Date().toISOString();
  for (const nome of aCriar) {
    const ref = db.collection("people").doc();
    lote.set(ref, {
      nome,
      // Sem e-mail: vem depois, e é ele que liga a conta quando a pessoa criar.
      telefone: "",
      fotoUrl: "",
      // Inativa até ter acesso vinculado; ver inativar-sem-acesso.mjs.
      ativo: false,
      criadoEm: agora,
    });
    idPorNome.set(normalizar(nome), ref.id);
  }
  await lote.commit();
  console.log(`\n  ${aCriar.length} pessoas criadas.`);
}

// ------------------------------------------------------------ elenco por peça
console.log("\nELENCO POR PEÇA");
let totalPersonagens = 0;
let totalParticipacoes = 0;

for (const elenco of ELENCOS) {
  const documento = pecaPorTitulo.get(elenco.peca);
  if (!documento) {
    console.log(`\n  "${elenco.peca}" — PULA: peça não cadastrada`);
    continue;
  }
  const peca = documento.data();
  const existentes = await documento.ref.collection("characters").get();
  if (!existentes.empty) {
    console.log(`\n  "${elenco.peca}" — PULA: já tem ${existentes.size} personagem(ns)`);
    continue;
  }

  console.log(`\n  "${elenco.peca}" (${peca.nomeEvento} · ${peca.dataApresentacao})`);
  console.log(`     ${elenco.papeis.length} personagens`);
  for (const [ator, personagem, rotulo] of elenco.papeis) {
    if (!TIPO[rotulo]) throw new Error(`Tipo de papel desconhecido: "${rotulo}"`);
    console.log(`       ${personagem.padEnd(32)} ${canonico(ator).padEnd(34)} ${TIPO[rotulo]}`);
  }
  totalPersonagens += elenco.papeis.length;
  totalParticipacoes += elenco.papeis.length;

  if (!aplicar) continue;

  const lote = db.batch();
  const agora = new Date().toISOString();
  elenco.papeis.forEach(([ator, personagem, rotulo], ordem) => {
    const nome = canonico(ator);
    const personId = idPorNome.get(normalizar(nome));
    if (!personId) throw new Error(`Pessoa não resolvida: "${nome}"`);

    const personagemRef = documento.ref.collection("characters").doc();
    lote.set(personagemRef, {
      playId: documento.id,
      nome: personagem,
      descricao: "",
      tipoPapel: TIPO[rotulo],
      observacoes: "",
      imagemUrl: "",
      personId,
      personNome: nome,
      situacao: "confirmado",
      ordem,
    });

    lote.set(db.collection("participations").doc(), {
      personId,
      playId: documento.id,
      playTitulo: peca.titulo,
      playEvento: peca.nomeEvento ?? "",
      playCapaUrl: peca.capaUrl ?? "",
      characterId: personagemRef.id,
      characterNome: personagem,
      tipoPapel: TIPO[rotulo],
      periodo: peca.dataApresentacao,
      concluidaEm: agora,
    });
  });
  await lote.commit();
  console.log(`     gravado`);
}

console.log(
  `\nTOTAL — ${aCriar.length} pessoas, ${totalPersonagens} personagens, ` +
    `${totalParticipacoes} participações`,
);
if (!aplicar) console.log("\nRode de novo com --aplicar para gravar.\n");
process.exit(0);
