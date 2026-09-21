/**
 * Integridade do banco: o que aponta para o que, e o que deveria existir.
 *
 * Só lê. É a verificação mais barata e a que mais vezes pegou coisa de
 * verdade — nome de pessoa que ficou velho dentro do personagem, peça que
 * mudou de título e não avisou o histórico, campo pessoal que voltou para a
 * ficha que todo mundo lê.
 */
import { auth, db } from "../firebase-admin-app.mjs";
import { criarCaderno } from "./relatorio.mjs";

const comId = (d) => ({ id: d.id, ...d.data() });

/** Campos que **não** podem estar na ficha pública. Ver `privado/contato`. */
const PESSOAIS = ["email", "telefone", "nascimento", "responsavelNome", "responsavelTelefone"];

export const nome = "dados";
export const titulo = "Integridade do banco";

export async function rodar() {
  const { achados, anotar } = criarCaderno();

  const pessoas = (await db.collection("people").get()).docs.map(comId);
  const pecas = (await db.collection("plays").get()).docs.map(comId);
  const contas = (await db.collection("users").get()).docs.map(comId);
  const participacoes = (await db.collection("participations").get()).docs.map(comId);
  const ensaios = (await db.collection("rehearsals").get()).docs.map(comId);
  const exercicios = (await db.collection("exercicios").get()).docs.map(comId);
  const convites = (await db.collection("convites").get()).docs.map(comId);
  const caracteristicas = (await db.collection("traits").get()).docs.map(comId);

  const direcao = {};
  for (const d of (await db.collection("direcao").get()).docs) direcao[d.id] = d.data();

  /* As cenas que cada roteiro tem, para conferir os trechos dos encontros. */
  const falasPorPeca = new Map();
  for (const peca of pecas) {
    const cenas = new Set();
    for (const f of (await db.collection("plays").doc(peca.id).collection("lines").get()).docs) {
      const v = f.data();
      cenas.add(`${v.ato}-${v.cena}`);
    }
    falasPorPeca.set(peca.id, cenas);
  }

  const personagens = [];
  for (const peca of pecas) {
    for (const c of (await db.collection("plays").doc(peca.id).collection("characters").get()).docs) {
      personagens.push({ ...comId(c), peca });
    }
  }

  const porPessoa = new Map(pessoas.map((p) => [p.id, p]));
  const porPeca = new Map(pecas.map((p) => [p.id, p]));
  const idsDePersonagem = new Set(personagens.map((c) => c.id));

  const volumes =
    `${pessoas.length} pessoas · ${pecas.length} peças · ${personagens.length} personagens · ` +
    `${participacoes.length} participações · ${contas.length} contas · ${ensaios.length} ensaios · ` +
    `${exercicios.length} exercícios · ${convites.length} convites`;

  /* ------------------------------------------------- quem é escalado no quê */
  for (const c of personagens) {
    if (!c.personId) continue;
    const pessoa = porPessoa.get(c.personId);
    if (!pessoa) {
      anotar("alta", `${c.peca.titulo} › ${c.nome}`, "escalado para uma ficha que não existe");
    } else if (c.personNome !== pessoa.nome) {
      anotar(
        "média",
        `${c.peca.titulo} › ${c.nome}`,
        `o nome guardado no papel ("${c.personNome}") não é mais o da pessoa ("${pessoa.nome}")`,
      );
    }
  }

  /* ------------------------------------------- o histórico contra as peças */
  for (const p of participacoes) {
    const pessoa = porPessoa.get(p.personId);
    const peca = porPeca.get(p.playId);
    const quem = pessoa?.nome ?? `participação ${p.id}`;
    if (!pessoa) anotar("alta", `participação ${p.id}`, "de uma ficha que não existe");
    if (!peca) {
      anotar("alta", `participação ${p.id}`, "de uma peça que não existe");
    } else {
      if (p.playTitulo !== peca.titulo) {
        anotar("média", quem, `o histórico ainda chama a peça de "${p.playTitulo}"`);
      }
      if (p.periodo !== peca.dataApresentacao) {
        anotar("média", quem, "a data no histórico não é a da peça");
      }
    }
    if (p.characterId && !idsDePersonagem.has(p.characterId)) {
      anotar("média", quem, "aponta para um personagem que foi apagado");
    }
  }

  for (const peca of pecas) {
    const encerrada = ["concluida", "arquivada"].includes(peca.status);
    const escalados = personagens.filter((c) => c.peca.id === peca.id && c.personId);
    const daPeca = participacoes.filter((p) => p.playId === peca.id);
    if (encerrada) {
      for (const c of escalados) {
        if (!daPeca.some((p) => p.characterId === c.id)) {
          anotar("alta", `${peca.titulo} › ${c.nome}`, "peça encerrada e ninguém entrou no histórico");
        }
      }
    } else if (daPeca.length > 0) {
      anotar("média", peca.titulo, "tem histórico sem estar encerrada");
    }
  }

  /*
   * Mais de uma peça em cartaz deixou de ser erro — Natal e Páscoa em paralelo
   * é o normal do grupo. O que continua sendo problema é nenhuma: aí o elenco
   * abre o app e não vê personagem, roteiro nem ensaio.
   */
  const emCartaz = pecas.filter((p) => p.atual);
  if (emCartaz.length === 0) {
    anotar("média", "cartaz", "nenhuma peça em cartaz: o elenco não vê personagem nem roteiro");
  }
  for (const peca of emCartaz) {
    if (["concluida", "arquivada"].includes(peca.status)) {
      anotar("média", peca.titulo, "encerrada e ainda em cartaz para o elenco");
    }
  }

  /* Encontros: apresentação sem evento, e trecho que não existe no roteiro. */
  for (const e of ensaios) {
    const peca = porPeca.get(e.playId);
    if (!peca) {
      anotar("alta", `encontro de ${e.data}`, "de uma peça que não existe");
      continue;
    }
    if (e.tipo === "apresentacao" && !e.nomeEvento) {
      anotar("baixa", `${peca.titulo} · ${e.data}`, "apresentação sem nome do evento");
    }
    for (const t of e.trechos ?? []) {
      const existe = falasPorPeca.get(e.playId)?.has(`${t.ato}-${t.cena}`);
      if (!existe) {
        anotar("média", `${peca.titulo} · ${e.data}`, `marcado para o ato ${t.ato}, cena ${t.cena}, que não existe no roteiro`);
      }
    }
  }

  /* -------------------------------------- o que é pessoal ficou no lugar */
  for (const p of pessoas) {
    for (const campo of PESSOAIS) {
      if (p[campo] !== undefined) {
        anotar("alta", p.nome, `"${campo}" voltou para a ficha que todo o elenco lê`);
      }
    }
  }

  /* ----------------------------------------------- contas, Auth e claims */
  const noAuth = (await auth.listUsers(1000)).users;
  const uids = new Set(noAuth.map((u) => u.uid));

  for (const conta of contas) {
    const quem = conta.email ?? `conta ${conta.id}`;
    if (!uids.has(conta.id)) anotar("média", quem, "tem cadastro mas não existe no Authentication");
    if (conta.personId && !porPessoa.has(conta.personId)) {
      anotar("alta", quem, "ligada a uma ficha que não existe");
    }
    const namesmaFicha = contas.filter((o) => o.personId && o.personId === conta.personId);
    if (namesmaFicha.length > 1) {
      anotar(
        "alta",
        porPessoa.get(conta.personId)?.nome ?? conta.personId,
        `${namesmaFicha.length} contas ligadas à mesma ficha`,
      );
    }
  }

  for (const u of noAuth) {
    const conta = contas.find((c) => c.id === u.uid);
    if (!conta) {
      const ficha = porPessoa.get(u.uid);
      anotar(
        "média",
        u.email ?? `uid ${u.uid}`,
        ficha
          ? `conta órfã com o id da ficha de ${ficha.nome} — provável engano de script`
          : "existe no Authentication e não tem cadastro no app",
      );
      continue;
    }
    const claims = u.customClaims ?? {};
    if (claims.role !== conta.role || (claims.personId ?? null) !== (conta.personId ?? null)) {
      anotar(
        "média",
        u.email ?? u.uid,
        "o token não reflete o papel ou o vínculo — o Storage pode recusar a troca de foto",
      );
    }
  }

  const comAcesso = new Set(contas.map((c) => c.personId).filter(Boolean));
  for (const p of pessoas) {
    if (!comAcesso.has(p.id) && p.ativo !== false) anotar("média", p.nome, "ativa e ainda sem acesso");
    if (comAcesso.has(p.id) && p.ativo === false) anotar("média", p.nome, "inativa mas com acesso");
  }

  /* --------------------------------------------- convites e exercícios */
  const agora = new Date().toISOString();
  for (const c of convites) {
    if (!porPessoa.has(c.personId)) {
      anotar("média", `convite ${c.codigo ?? c.id}`, "aponta para uma ficha que não existe");
    }
    if (!c.usadoEm && c.expiraEm < agora && comAcesso.has(c.personId) === false) {
      anotar("baixa", porPessoa.get(c.personId)?.nome ?? c.id, "convite venceu sem ser usado");
    }
  }
  for (const e of exercicios) {
    if (!e.youtubeUrl) anotar("média", e.nome ?? e.id, "exercício sem link de vídeo");
  }

  /* Avisos de indisponibilidade que apontam para quem não existe mais. */
  for (const a of (await db.collection("indisponibilidades").get()).docs) {
    const v = a.data();
    if (!porPessoa.has(v.personId)) {
      anotar("média", `indisponibilidade ${a.id}`, "de uma ficha que não existe");
    }
    if (v.de > v.ate) {
      anotar("média", v.personNome ?? a.id, "aviso com o fim antes do começo");
    }
  }

  /* ------------------------------------ características de quem não existe */
  for (const grupo of ["pessoas", "papeis"]) {
    for (const [id, atribuidas] of Object.entries(direcao.caracteristicas?.[grupo] ?? {})) {
      const existe = grupo === "pessoas" ? porPessoa.has(id) : idsDePersonagem.has(id);
      if (!existe) anotar("baixa", `direcao/${grupo}/${id}`, "o registro avaliado foi apagado");
      for (const t of atribuidas ?? []) {
        if (!caracteristicas.some((x) => x.id === t)) {
          anotar("baixa", `direcao/${grupo}/${id}`, `característica "${t}" não existe mais`);
        }
      }
    }
  }

  /* ------------------------------------------- subcoleção sem documento */
  for (const colecao of ["rehearsals", "plays", "people"]) {
    for (const ref of await db.collection(colecao).listDocuments()) {
      if ((await ref.get()).exists) continue;
      const dentro = await ref.listCollections();
      if (dentro.length > 0) {
        anotar("baixa", `${colecao}/${ref.id}`, "documento apagado que deixou dados embaixo");
      }
    }
  }

  return { achados, resumo: volumes };
}
