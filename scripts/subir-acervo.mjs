#!/usr/bin/env node
/**
 * Sobe o acervo completo: peças, elenco e direção.
 *
 * Faz quatro coisas, nesta ordem, porque cada uma depende da anterior:
 *   1. cria as peças que faltam e ajusta "elenco fechado" nas que existem;
 *   2. cria as pessoas que faltam;
 *   3. cria personagens e participações das peças ainda sem elenco;
 *   4. grava a direção de cada peça.
 *
 * Um lote por peça: elenco pela metade no histórico é pior que elenco nenhum,
 * porque ninguém percebe o que ficou faltando.
 *
 * Idempotente. Peça que já tem personagem não recebe elenco de novo — a
 * direção, sim, porque é campo da peça e sobrescrever é seguro. Pessoa é
 * reaproveitada por nome normalizado.
 *
 *   node scripts/subir-acervo.mjs            confere
 *   node scripts/subir-acervo.mjs --aplicar  grava
 */
import { db } from "./firebase-admin-app.mjs";

/** Rótulos da lista → tipos de papel do app. */
const TIPO = {
  Principal: "protagonista",
  Antagonista: "antagonista",
  "Participação Especial": "especial",
  Narrador: "narrador",
  Figurante: "figurante",
};

/*
 * Nomes que se referem à mesma pessoa. Sem isto o acervo ganha ficha duplicada
 * e o histórico se divide entre duas — o pior defeito possível aqui, porque é
 * silencioso: só aparece quando alguém reclama que falta peça na própria lista.
 */
const MESMA_PESSOA = {
  "pedro castanho": "Pedro Henrique Ferreira Castanho",
  "daniela golcalves": "Daniela Gonçalves",
  "liu macedo": "Leonardo Macedo",
  "luis furlan": "Luís Furlan",
  celine: "Celine Mocarzel",
  weslley: "Weslley Ferreira",
};

/*
 * Acervo como recebido, com o português corrigido nos nomes de personagem —
 * "Espirito" → "Espírito", "Moises" → "Moisés", "Adolecente" → "Adolescente" —
 * seguindo o pedido de corrigir a grafia.
 *
 * `papeis`: [pessoa, personagem ou null, rótulo do tipo ou null, função].
 * Função é "diretor", "vice" ou null. Pessoa sem personagem só dirigiu.
 */
const ACERVO = [
  {
    titulo: "O Retorno de Tuka",
    evento: "Aniversário 15 Anos Aliança",
    data: "28/05/2023",
    fechado: true,
    papeis: [
      ["Giovanna Thomazi", "Tuka", "Principal", "diretor"],
      ["Celine Mocarzel", "Conceição", "Principal", "vice"],
    ],
  },
  {
    titulo: "Os Invencíveis",
    evento: "Rede Mil 2023",
    data: "08/10/2023",
    fechado: true,
    papeis: [
      ["Weslley Ferreira", null, null, "diretor"],
      ["Pedro Castanho", "Davi", "Principal", null],
      ["Luan Oliveira", "Moisés", "Principal", null],
      ["Leonardo Macedo", "Daniel", "Principal", null],
      ["Tibério Silva", "Sansão", "Participação Especial", null],
      ["Cleiton Tejada", "Abraão", "Participação Especial", null],
      ["Sophia Antiga", "Ester", "Participação Especial", null],
      ["Cauê Eugênio", "Jacó", "Participação Especial", null],
      ["Lucas Produção", "Golias", "Participação Especial", null],
      ["Gabriel Maui", "José", "Participação Especial", null],
    ],
  },
  {
    titulo: "Ele É",
    evento: "Páscoa 2024",
    data: "31/03/2024",
    fechado: false,
    papeis: [
      ["Weslley Ferreira", null, null, "diretor"],
      ["Pedro Castanho", "Pedro", "Principal", null],
      ["Leonardo Macedo", "Cléofas", "Participação Especial", null],
      ["Carlos Dias", "Jesus", "Principal", null],
      ["Agleston Teruo", "Narrador", "Narrador", null],
    ],
  },
  {
    titulo: "A História de Moisés",
    evento: "Convenção 2024",
    data: "13/07/2024",
    fechado: true,
    papeis: [
      ["Pedro Castanho", "Anrão", "Participação Especial", null],
      ["Sarah Thomazi", "Joquebede", "Participação Especial", null],
      ["Felipe Furlan", "Soldado", "Participação Especial", null],
      ["Luís Furlan", "Escravo", "Figurante", null],
      ["Weslley Ferreira", "Moisés", "Principal", "diretor"],
      ["Leonardo Macedo", "Moisés Adolescente", "Principal", null],
      ["Daniela Gonçalves", "Filha de Faraó", "Participação Especial", null],
    ],
  },
  {
    titulo: "Jardim Secreto",
    evento: "Rede Mil 2024",
    data: "19/10/2024",
    fechado: true,
    papeis: [
      ["Pedro Castanho", "Paçoca", "Principal", "vice"],
      ["Leonardo Macedo", "Carioca", "Principal", "vice"],
      ["Weslley Ferreira", "Apresentador", "Participação Especial", "diretor"],
      ["Bruna Manzalli", "Fazendeira", "Figurante", null],
      ["Luis Furlan", "Fazendeiro", "Figurante", null],
    ],
  },
  {
    titulo: "Mudança de Vida",
    evento: "Evangelismo 2024",
    data: "23/11/2024",
    fechado: true,
    papeis: [
      ["Pedro Castanho", "Crente Afastado", "Principal", "diretor"],
      ["Weslley Ferreira", "Amigo Crente", "Principal", "vice"],
    ],
  },
  {
    titulo: "Filho Pródigo",
    evento: "Culto de Colheita",
    data: "16/02/2025",
    fechado: true,
    papeis: [
      ["Weslley Ferreira", null, null, "diretor"],
      ["Pedro Castanho", "Filho Pródigo", "Principal", "vice"],
      ["Sarah Thomazi", "Irmã do Filho Pródigo", "Participação Especial", null],
      ["Leonardo Macedo", "Pai do Filho Pródigo", "Participação Especial", null],
      ["Pedro Mori", "Amigo Bêbado 1", "Figurante", null],
      ["Guilherme Diana", "Amigo Bêbado 2", "Figurante", null],
    ],
  },
  {
    titulo: "A Recompensa",
    evento: "Páscoa 2025",
    data: "20/04/2025",
    fechado: false,
    papeis: [
      ["Pedro Castanho", "Pedro", "Principal", "vice"],
      ["Leonardo Macedo", "Estevão", "Principal", "vice"],
      ["Weslley Ferreira", "Paulo", "Principal", "diretor"],
    ],
  },
  {
    titulo: "Nascimento de Jesus",
    evento: "Convenção 2025",
    data: "18/07/2025",
    fechado: true,
    papeis: [
      ["Pedro Castanho", "José", "Principal", "vice"],
      ["Nicoli Diana", "Maria", "Principal", null],
      ["Isac Borel", "Jesus", "Participação Especial", null],
      ["Celine Mocarzel", "Isabel", "Participação Especial", null],
      ["Sophia Cinta", "Camponesa 1", "Figurante", null],
      ["Beatriz Borel", "Camponesa 2", "Figurante", null],
      ["Weslley Ferreira", "Anjo", "Participação Especial", "diretor"],
    ],
  },
  {
    titulo: "Além do Céu Azul",
    evento: "Rede Mil 2025",
    data: "12/10/2025",
    fechado: true,
    papeis: [
      ["Celine", null, null, "diretor"],
      ["Pedro Castanho", "Paçoca", "Principal", "vice"],
      ["Leonardo Macedo", "Carioca", "Principal", "vice"],
      ["Isabela Martins", "Perdita", "Principal", null],
      ["Sarah Thomazi", "Balonista", "Participação Especial", null],
      ["Davi Fogaça", "Piloto", "Participação Especial", null],
      ["Beatriz Borel", "Astronauta", "Participação Especial", null],
    ],
  },
  {
    titulo: "Quem Deus Diz que Somos I",
    evento: "Encontro 2025",
    data: "26/10/2025",
    fechado: true,
    papeis: [
      ["Weslley", null, null, "diretor"],
      ["Bruna Manzalli", "Amanda", "Principal", "vice"],
      ["Letícia Diana", "Amanda Criança", "Antagonista", null],
      ["Pedro Castanho", "Ex Namorado da Amanda", "Antagonista", "vice"],
      ["Davi Fogaça", "Ex Namorado Recente da Amanda", "Antagonista", null],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista", null],
      ["Daniela Golçalves", "Mãe da Amanda", "Antagonista", null],
      ["Eduarda Reis", "Amiga falsa da Amanda", "Antagonista", null],
      ["Sarah Thomazi", "Amiga Crente da Amanda", "Principal", null],
      ["Agleston Teruo", "Espírito Santo da Amanda", "Participação Especial", null],
    ],
  },
  {
    titulo: "A Resposta",
    evento: "Natal 2025",
    data: "22/12/2025",
    fechado: false,
    papeis: [
      ["Guilherme Carvalho", "Roboão", "Principal", null],
      ["Murilo Lima", "Geroboão", "Principal", null],
      ["Guilherme Diana", "Adão", "Principal", null],
      ["Gabriel Camacho", "Saul", "Principal", null],
      // Três papéis para a mesma pessoa: agora o modelo aceita.
      ["Pedro Castanho", "Assistente do Rei Saul", "Figurante", null],
      ["Pedro Castanho", "Guerreiro", "Figurante", null],
      ["Pedro Castanho", "Narrador de Saul", "Narrador", null],
      ["Bruna Manzalli", "Narrador de Adão", "Narrador", null],
      ["Leonardo Macedo", "Assistente do Rei Saul", "Figurante", null],
      ["Leonardo Macedo", "Conselheiro Jovem", "Figurante", null],
      ["Leonardo Macedo", "Guerreiro", "Figurante", null],
      ["Weslley Ferreira", "Samuel", "Participação Especial", "diretor"],
    ],
  },
  {
    titulo: "Pecados que Aprisionam",
    evento: "Carnaval 2026",
    data: "16/02/2026",
    fechado: false,
    papeis: [],
  },
  {
    titulo: "Está Consumado",
    evento: "Páscoa 2026",
    data: "05/04/2026",
    fechado: false,
    papeis: [
      ["Davi Fogaça", "Pedro", "Principal", null],
      ["Carlos Dias", "Jesus", "Principal", null],
    ],
  },
  {
    titulo: "Quem Deus Diz que Somos II",
    evento: "Encontro 2026 I",
    data: "11/04/2026",
    fechado: true,
    papeis: [
      ["Bruna Manzalli", "Amanda", "Principal", null],
      ["Letícia Diana", "Amanda Criança", "Antagonista", null],
      ["Pedro Castanho", "Ex Namorado", "Antagonista", null],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista", null],
      ["Daniela Gonçalves", "Mãe da Amanda", "Antagonista", null],
      ["Julia Alves", "Amiga falsa da Amanda", "Antagonista", null],
      ["Sarah Thomazi", "Amiga Crente da Amanda", "Principal", null],
      ["Agleston Teruo", "Espírito Santo da Amanda", "Participação Especial", null],
      ["Davi Fogaça", "Thiago", "Principal", null],
      ["Caio Freitas", "Thiago Criança", "Antagonista", null],
      ["Amanda Costa", "Ex Namorada do Thiago", "Antagonista", null],
      ["Weslley Ferreira", "Pai do Thiago", "Antagonista", null],
      ["Karina Rocha", "Mãe do Thiago", "Antagonista", null],
      ["Pedro Mori", "Amigo Falso do Thiago", "Antagonista", null],
      ["Bruno Reis", "Amigo Crente do Thiago", "Principal", null],
      ["Luan Oliveira", "Espírito Santo do Thiago", "Participação Especial", null],
    ],
  },
  {
    titulo: "Paçoca, Franjinha e Grandão no Avalanche",
    evento: "10 Anos de Avalanche",
    data: "25/04/2026",
    fechado: true,
    papeis: [
      ["Pedro Castanho", "Paçoca", "Principal", null],
      ["Davi Fogaça", "Franjinha", "Principal", null],
      ["Pedro Mori", "Grandão", "Principal", null],
      ["Julia Alves", "Lumi", "Principal", null],
      ["Guilherme Diana", "Mestre de Jiujutsu", "Participação Especial", null],
      ["Beatriz Batista", "Aluna", "Figurante", null],
    ],
  },
  {
    titulo: "Quem Deus Diz que Somos III",
    evento: "Encontro 2026 II",
    data: "03/07/2026",
    fechado: true,
    papeis: [
      ["Bruna Manzalli", "Amanda", "Principal", null],
      ["Letícia Diana", "Amanda Criança", "Antagonista", null],
      ["Pedro Castanho", "Ex Namorado da Amanda", "Antagonista", null],
      ["Guilherme Diana", "Pai da Amanda", "Antagonista", null],
      ["Amanda Letícia", "Mãe da Amanda", "Antagonista", null],
      ["Julia Alves", "Amiga Falsa da Amanda", "Antagonista", null],
      ["Beatriz Batista", "Amiga Crente da Amanda", "Principal", null],
      ["Davi Fogaça", "Thiago", "Principal", null],
      ["Isac Borel", "Thiago Criança", "Antagonista", null],
      ["Tailana Gomes", "Ex Namorada do Thiago", "Antagonista", null],
      ["Liu Macedo", "Pai do Thiago", "Antagonista", null],
      ["Celine Mocarzel", "Mãe do Thiago", "Antagonista", null],
      ["Pedro Mori", "Amigo Falso do Thiago", "Antagonista", null],
      ["Bruno Reis", "Amigo Crente do Thiago", "Principal", null],
    ],
  },
];

const aplicar = process.argv.includes("--aplicar");

const normalizar = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const canonico = (n) => {
  const limpo = n.replace(/\s+/g, " ").trim();
  return MESMA_PESSOA[normalizar(limpo)] ?? limpo;
};
const paraISO = (br) => {
  const [d, m, a] = br.split("/");
  return `${a}-${m}-${d}`;
};

for (const peca of ACERVO) {
  for (const [, , rotulo] of peca.papeis) {
    if (rotulo !== null && !TIPO[rotulo]) throw new Error(`Tipo desconhecido: "${rotulo}"`);
  }
}

console.log(`\n${aplicar ? "APLICANDO" : "CONFERINDO (nada será escrito)"}\n`);

/* ------------------------------------------------------------------ 1. peças */

const existentes = await db.collection("plays").get();
const pecaPorTitulo = new Map(existentes.docs.map((d) => [d.data().titulo, d]));
const agora = new Date().toISOString();

console.log("1. PEÇAS");
const criadas = new Map();
for (const peca of ACERVO) {
  const data = paraISO(peca.data);
  const doc = pecaPorTitulo.get(peca.titulo);
  if (doc) {
    const mudaElenco = (doc.data().elencoFechado ?? false) !== peca.fechado;
    console.log(
      `   ${peca.titulo.padEnd(42)} existe${mudaElenco ? ` · elenco → ${peca.fechado ? "fechado" : "em aberto"}` : ""}`,
    );
    if (aplicar && mudaElenco) await doc.ref.update({ elencoFechado: peca.fechado });
    continue;
  }
  console.log(`   ${peca.titulo.padEnd(42)} CRIAR (${data})`);
  if (!aplicar) continue;
  const ref = db.collection("plays").doc();
  await ref.set({
    titulo: peca.titulo,
    nomeEvento: peca.evento,
    descricao: "",
    capaUrl: "",
    dataApresentacao: data,
    local: "",
    status: "concluida",
    atual: false,
    elencoFechado: peca.fechado,
    roteiroVersao: 0,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: agora,
  });
  criadas.set(peca.titulo, ref);
}

/* ---------------------------------------------------------------- 2. pessoas */

const pessoasSnap = await db.collection("people").get();
const idPorNome = new Map(pessoasSnap.docs.map((d) => [normalizar(d.data().nome ?? ""), d.id]));

const envolvidas = new Map();
for (const peca of ACERVO) {
  for (const [ator] of peca.papeis) {
    const nome = canonico(ator);
    envolvidas.set(normalizar(nome), nome);
  }
}
const faltando = [...envolvidas].filter(([chave]) => !idPorNome.has(chave)).map(([, n]) => n);

console.log(`\n2. PESSOAS — ${envolvidas.size} envolvidas, ${faltando.length} a criar`);
faltando.forEach((n) => console.log(`   criar: ${n}`));

if (aplicar && faltando.length > 0) {
  const lote = db.batch();
  for (const nome of faltando) {
    const ref = db.collection("people").doc();
    lote.set(ref, { nome, email: "", telefone: "", fotoUrl: "", ativo: true, criadoEm: agora });
    idPorNome.set(normalizar(nome), ref.id);
  }
  await lote.commit();
}

/* -------------------------------------------------- 3. elenco e 4. direção */

console.log("\n3. ELENCO E DIREÇÃO");
let novosPersonagens = 0;
let novasParticipacoes = 0;

for (const peca of ACERVO) {
  const ref = criadas.get(peca.titulo) ?? pecaPorTitulo.get(peca.titulo)?.ref;
  if (!ref) {
    console.log(`   ${peca.titulo.padEnd(42)} PULA (peça não existe ainda; rode com --aplicar)`);
    continue;
  }
  const dados = (await ref.get()).data();

  // Direção é campo da peça: sobrescrever é seguro e vale sempre.
  const direcao = { diretores: [], vicesDiretores: [] };
  for (const [ator, , , funcao] of peca.papeis) {
    if (!funcao) continue;
    const id = idPorNome.get(normalizar(canonico(ator)));
    if (!id) continue;
    const alvo = funcao === "diretor" ? direcao.diretores : direcao.vicesDiretores;
    if (!alvo.includes(id)) alvo.push(id);
  }

  const jaTem = (await ref.collection("characters").get()).size;
  const comPersonagem = peca.papeis.filter(([, personagem]) => personagem);
  const situacao =
    jaTem > 0
      ? `já tem ${jaTem} personagem(ns) — só a direção`
      : comPersonagem.length === 0
        ? "sem elenco na lista"
        : `${comPersonagem.length} personagens, ${comPersonagem.length} participações`;

  console.log(
    `   ${peca.titulo.padEnd(42)} ${situacao}` +
      (direcao.diretores.length + direcao.vicesDiretores.length > 0
        ? ` · direção ${direcao.diretores.length}+${direcao.vicesDiretores.length}`
        : ""),
  );

  if (!aplicar) continue;
  await ref.update(direcao);
  if (jaTem > 0 || comPersonagem.length === 0) continue;

  const lote = db.batch();
  comPersonagem.forEach(([ator, personagem, rotulo], ordem) => {
    const nome = canonico(ator);
    const personId = idPorNome.get(normalizar(nome));
    if (!personId) throw new Error(`Pessoa não resolvida: "${nome}"`);
    const tipoPapel = TIPO[rotulo] ?? "coadjuvante";

    const personagemRef = ref.collection("characters").doc();
    lote.set(personagemRef, {
      playId: ref.id,
      nome: personagem,
      descricao: "",
      tipoPapel,
      observacoes: "",
      imagemUrl: "",
      personId,
      personNome: nome,
      situacao: "confirmado",
      ordem,
    });
    lote.set(db.collection("participations").doc(), {
      personId,
      playId: ref.id,
      playTitulo: peca.titulo,
      playEvento: peca.evento,
      playCapaUrl: "",
      characterId: personagemRef.id,
      characterNome: personagem,
      tipoPapel,
      periodo: paraISO(peca.data),
      concluidaEm: agora,
    });
    novosPersonagens++;
    novasParticipacoes++;
  });
  await lote.commit();
}

console.log(
  `\nTOTAL — ${faltando.length} pessoas, ${novosPersonagens} personagens, ` +
    `${novasParticipacoes} participações`,
);
if (!aplicar) console.log("\nRode de novo com --aplicar para gravar.\n");
process.exit(0);
