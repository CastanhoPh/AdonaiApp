import {
  collection,
  doc,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, getDoc, comId } from "./firestore";
import { hojeISO } from "../format";
import { listarPersonagens } from "./personagens";
import type {
  Participation,
  Play,
  RoleType,
} from "../types";

/* ------------------------------------------------------------------- peças */

/**
 * Peças da mais recente para a mais antiga, pela data de apresentação.
 *
 * Antes vinham por data de cadastro, o que só coincide com a ordem real
 * enquanto se cadastra na sequência em que as peças acontecem. Ao subir o
 * acervo de uma vez, as treze entraram no mesmo instante e a lista saiu
 * embaralhada — 2024 depois de 2026.
 *
 * A ordenação é feita aqui e não no Firestore para não exigir índice composto
 * nem excluir peça sem data: `orderBy` no servidor descarta documento sem o
 * campo, e peça em planejamento pode não ter data ainda.
 */
export async function listarPecas(): Promise<Play[]> {
  const snap = await getDocs(collection(db, "plays"));
  const pecas = snap.docs.map((d) => comId<Play>(d));
  return pecas.sort((a, b) => {
    // Sem data vai para o topo: é peça sendo montada agora.
    const x = a.dataApresentacao || "9999-12-31";
    const y = b.dataApresentacao || "9999-12-31";
    if (x !== y) return y.localeCompare(x);
    return (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
  });
}

export async function buscarPeca(id: string): Promise<Play | null> {
  const snap = await getDoc(doc(db, "plays", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Play) : null;
}

/** Apenas uma peça é a atual; a consulta devolve a primeira marcada. */
export async function buscarPecaAtual(): Promise<Play | null> {
  const snap = await getDocs(query(collection(db, "plays"), where("atual", "==", true), limit(1)));
  const primeiro = snap.docs[0];
  return primeiro ? comId<Play>(primeiro) : null;
}

/** Campos que quem cria a peça informa; o resto nasce com valor padrão. */
export type NovaPeca = Omit<
  Play,
  "id" | "criadoEm" | "roteiroVersao" | "roteiroPublicado" | "roteiroPublicadoEm" | "roteiroEditadoEm"
>;

export async function criarPeca(dados: NovaPeca): Promise<string> {
  const ref = doc(collection(db, "plays"));
  await setDoc(ref, {
    ...dados,
    atual: false,
    roteiroVersao: 1,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: new Date().toISOString(),
  });
  if (dados.atual) await definirPecaAtual(ref.id);
  return ref.id;
}

/**
 * Atualiza a peça e leva as mudanças para as cópias no histórico.
 *
 * A participação guarda `playTitulo`, `playEvento`, `playCapaUrl` e `periodo`
 * para o histórico de alguém não depender de a peça continuar existindo. O
 * preço é que renomear ou redatar uma peça já encerrada deixava todas as
 * fichas mostrando o nome e a data antigos — e o histórico é justamente onde
 * ninguém repara que ficou desatualizado.
 *
 * Só peça encerrada tem participação; nas outras o laço não acha nada e não
 * custa quase nada.
 */
export async function atualizarPeca(id: string, dados: Partial<Play>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  delete limpo.atual; // trocar a peça atual passa por definirPecaAtual

  /* Só o que aparece copiado, e só quando veio no pedido. */
  const naParticipacao: Record<string, string> = {};
  if (typeof limpo.titulo === "string") naParticipacao.playTitulo = limpo.titulo;
  if (typeof limpo.nomeEvento === "string") naParticipacao.playEvento = limpo.nomeEvento;
  if (typeof limpo.capaUrl === "string") naParticipacao.playCapaUrl = limpo.capaUrl;
  if (typeof limpo.dataApresentacao === "string") naParticipacao.periodo = limpo.dataApresentacao;

  if (Object.keys(naParticipacao).length === 0) {
    await updateDoc(doc(db, "plays", id), limpo);
    return;
  }

  const ligadas = await getDocs(
    query(collection(db, "participations"), where("playId", "==", id)),
  );
  const lote = writeBatch(db);
  lote.update(doc(db, "plays", id), limpo);
  ligadas.docs.forEach((p) => lote.update(p.ref, naParticipacao));
  await lote.commit();
}

/**
 * Marca a peça como atual e desmarca todas as outras — garante a regra de que
 * somente uma peça é considerada a peça atual.
 */
export async function definirPecaAtual(id: string): Promise<void> {
  const todas = await getDocs(collection(db, "plays"));
  const lote = writeBatch(db);
  let mudou = false;
  todas.docs.forEach((d) => {
    const deveSerAtual = d.id === id;
    if (Boolean(d.data().atual) !== deveSerAtual) {
      lote.update(d.ref, { atual: deveSerAtual });
      mudou = true;
    }
  });
  if (mudou) await lote.commit();
}

/**
 * Conclui a peça: registra a participação de cada personagem escalado no
 * histórico e deixa de considerá-la a peça atual. Devolve quantas
 * participações novas foram criadas.
 */
export async function concluirPeca(id: string): Promise<number> {
  const peca = await buscarPeca(id);
  if (!peca) throw new Error("Peça não encontrada.");

  const personagens = await listarPersonagens(id);
  const escalados = personagens.filter((p) => p.personId);

  const existentes = await getDocs(
    query(collection(db, "participations"), where("playId", "==", id)),
  );
  const jaRegistrados = new Set(
    existentes.docs.map((d) => `${d.data().personId}:${d.data().characterId}`),
  );

  const lote = writeBatch(db);
  let novos = 0;
  const agora = new Date().toISOString();

  for (const personagem of escalados) {
    const chave = `${personagem.personId}:${personagem.id}`;
    if (jaRegistrados.has(chave)) continue;
    const ref = doc(collection(db, "participations"));
    const participacao: Omit<Participation, "id"> = {
      personId: personagem.personId as string,
      playId: peca.id,
      playTitulo: peca.titulo,
      playEvento: peca.nomeEvento ?? "",
      playCapaUrl: peca.capaUrl ?? "",
      characterId: personagem.id,
      characterNome: personagem.nome,
      tipoPapel: personagem.tipoPapel,
      periodo: peca.dataApresentacao || hojeISO(),
      concluidaEm: agora,
    };
    lote.set(ref, participacao);
    novos += 1;
  }

  lote.update(doc(db, "plays", id), { status: "concluida", atual: false });
  await lote.commit();
  return novos;
}

/** Um personagem da peça antiga e quem o fez. */
export interface PapelAntigo {
  nome: string;
  tipoPapel: RoleType;
  /** Vazio quando não se lembra de quem fez: nada vai para o histórico. */
  personId: string;
  personNome: string;
}

/**
 * Registra no histórico uma peça que já aconteceu.
 *
 * O caminho normal de uma peça é planejamento → escalação → ensaio → conclusão,
 * e é a conclusão que grava a participação de cada um. Para peça antiga esse
 * caminho é só trabalho: ninguém vai ensaiar o que já foi apresentado. Aqui a
 * peça nasce concluída, com os personagens e as participações no mesmo lote —
 * ou tudo entra, ou nada entra, e não fica peça pela metade no histórico.
 *
 * Roteiro e elenco não são exigidos: peça antiga raramente tem o texto à mão, e
 * o elenco de anos atrás costuma ser lembrado depois. Nome, evento e data já
 * têm valor sozinhos — a peça fica registrada e recebe o resto quando der.
 */
export async function registrarPecaAntiga(dados: {
  titulo: string;
  nomeEvento: string;
  dataApresentacao: string;
  local: string;
  descricao: string;
  papeis: PapelAntigo[];
}): Promise<{ playId: string; participacoes: number }> {
  const lote = writeBatch(db);
  const agora = new Date().toISOString();
  const pecaRef = doc(collection(db, "plays"));

  lote.set(pecaRef, {
    titulo: dados.titulo,
    nomeEvento: dados.nomeEvento,
    descricao: dados.descricao,
    capaUrl: "",
    capaMiniUrl: "",
    dataApresentacao: dados.dataApresentacao,
    local: dados.local,
    status: "concluida",
    // Nunca a peça atual: já passou, e só uma peça pode ser a atual.
    atual: false,
    roteiroVersao: 0,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: agora,
  });

  let participacoes = 0;
  dados.papeis.forEach((papel, ordem) => {
    const personagemRef = doc(collection(db, "plays", pecaRef.id, "characters"));
    lote.set(personagemRef, {
      playId: pecaRef.id,
      nome: papel.nome,
      descricao: "",
      tipoPapel: papel.tipoPapel,
      observacoes: "",
      imagemUrl: "",
      personId: papel.personId || null,
      personNome: papel.personNome,
      situacao: papel.personId ? "confirmado" : "pendente",
      ordem,
    });

    if (!papel.personId) return;
    const participacaoRef = doc(collection(db, "participations"));
    lote.set(participacaoRef, {
      personId: papel.personId,
      playId: pecaRef.id,
      playTitulo: dados.titulo,
      playEvento: dados.nomeEvento,
      playCapaUrl: "",
      characterId: personagemRef.id,
      characterNome: papel.nome,
      tipoPapel: papel.tipoPapel,
      periodo: dados.dataApresentacao,
      concluidaEm: agora,
    });
    participacoes += 1;
  });

  await lote.commit();
  return { playId: pecaRef.id, participacoes };
}

/**
 * Define quem dirigiu a peça.
 *
 * Lista inteira de uma vez, não item por item: a tela edita o conjunto, e
 * gravar em partes deixaria estado intermediário visível para o elenco.
 */
export async function definirDirecao(
  playId: string,
  direcao: { diretores: string[]; vicesDiretores: string[] },
): Promise<void> {
  await updateDoc(doc(db, "plays", playId), direcao);
}

/**
 * Peças que a pessoa dirigiu ou co-dirigiu, da mais recente para a mais antiga.
 *
 * Filtra no cliente sobre a lista de peças em vez de consultar por
 * `array-contains`: seriam duas consultas — uma por campo — e cada uma exigiria
 * índice. O acervo tem dezenas de peças, não milhares, e a lista já é lida por
 * outras telas.
 */
export async function listarPecasDirigidas(personId: string): Promise<Play[]> {
  const pecas = await listarPecas();
  return pecas.filter(
    (p) => p.diretores?.includes(personId) || p.vicesDiretores?.includes(personId),
  );
}
