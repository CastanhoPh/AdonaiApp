import {
  collection,
  deleteDoc,
  doc,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, comId } from "./firestore";
import { atualizarPeca } from "./pecas";
import type {
  Character,
  Rehearsal,
  ScriptLine,
  TrechoDaPeca,
} from "../types";

/* ----------------------------------------------------------------- ensaios */

/** Ensaios ordenados por data crescente — os mais próximos primeiro. */
export async function listarEnsaios(playId?: string): Promise<Rehearsal[]> {
  const base = collection(db, "rehearsals");
  const snap = await getDocs(playId ? query(base, where("playId", "==", playId)) : query(base));
  return snap.docs
    .map((d) => comId<Rehearsal>(d))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
}


/**
 * Quem tem fala nos trechos escolhidos.
 *
 * É o que transforma "ato 2, cena 3" em uma convocação. Sem isto, a direção
 * marca um ensaio de uma cena e convoca o elenco inteiro porque conferir quem
 * fala ali, cena a cena, no roteiro, dá mais trabalho que chamar todos — e aí
 * quinze pessoas atravessam a cidade para assistir a três ensaiarem.
 *
 * Trecho vazio devolve vazio, e não "todo mundo": a tela lê isso como "a peça
 * inteira" e não precisa de lista. Confundir os dois faria um ensaio geral
 * nascer com a convocação congelada de quem falava no dia em que foi marcado.
 */
export async function quemFalaNosTrechos(
  playId: string,
  trechos: TrechoDaPeca[],
): Promise<string[]> {
  if (trechos.length === 0) return [];

  const desejados = new Set(trechos.map((t) => `${t.ato}-${t.cena}`));
  const falas = await getDocs(collection(db, "plays", playId, "lines"));
  const papeis = new Set<string>();
  for (const fala of falas.docs) {
    const v = fala.data() as ScriptLine;
    if (!desejados.has(`${v.ato}-${v.cena}`)) continue;
    (v.characterIds ?? []).forEach((id) => papeis.add(id));
  }
  if (papeis.size === 0) return [];

  const personagens = await getDocs(collection(db, "plays", playId, "characters"));
  const pessoas = new Set<string>();
  for (const personagem of personagens.docs) {
    const v = personagem.data() as Character;
    if (papeis.has(personagem.id) && v.personId) pessoas.add(v.personId);
  }
  return [...pessoas];
}

/** As cenas que a peça tem, para a direção escolher os trechos. */
export async function cenasDaPeca(playId: string): Promise<TrechoDaPeca[]> {
  const falas = await getDocs(collection(db, "plays", playId, "lines"));
  const vistas = new Map<string, TrechoDaPeca>();
  for (const fala of falas.docs) {
    const v = fala.data() as ScriptLine;
    vistas.set(`${v.ato}-${v.cena}`, { ato: v.ato, cena: v.cena });
  }
  return [...vistas.values()].sort((a, b) => a.ato - b.ato || a.cena - b.cena);
}

/**
 * A peça passa a tirar a data de apresentação das apresentações marcadas.
 *
 * `plays.dataApresentacao` e `plays.local` continuam existindo porque são o
 * que o acervo mostra e o que o histórico copia em `participations.periodo` —
 * uma peça de 2019 precisa dizer quando foi, e ninguém vai marcar encontro
 * retroativo para isso. O que mudou é quem os preenche: eram digitados na
 * ficha da peça **e** na marcação, dois lugares para o mesmo fato, que
 * divergiam no dia em que a apresentação mudava de data e alguém esquecia de
 * atualizar o outro.
 *
 * Vale a primeira apresentação, não a última: quando a peça sobe duas vezes, a
 * data da peça é a da estreia.
 *
 * Usa `atualizarPeca` de propósito, e não uma gravação direta — é ela que
 * propaga a data para o histórico de quem já participou.
 */
async function sincronizarApresentacaoNaPeca(playId: string): Promise<void> {
  const encontros = await getDocs(
    query(collection(db, "rehearsals"), where("playId", "==", playId)),
  );
  const apresentacoes = encontros.docs
    .map((d) => comId<Rehearsal>(d))
    .filter((e) => e.tipo === "apresentacao" && e.status !== "cancelado")
    .sort((a, b) => a.data.localeCompare(b.data));

  // Sem apresentação marcada, o que estiver na ficha da peça fica como está:
  // apagar levaria junto a data das peças do acervo, que nunca terão encontro.
  if (apresentacoes.length === 0) return;

  const estreia = apresentacoes[0];
  await atualizarPeca(playId, {
    dataApresentacao: estreia.data,
    local: estreia.local,
    ...(estreia.nomeEvento ? { nomeEvento: estreia.nomeEvento } : {}),
  });
}

export async function criarEnsaio(dados: Omit<Rehearsal, "id">): Promise<string> {
  const ref = doc(collection(db, "rehearsals"));
  await setDoc(ref, dados);
  if (dados.tipo === "apresentacao") await sincronizarApresentacaoNaPeca(dados.playId);
  return ref.id;
}

export async function atualizarEnsaio(id: string, dados: Partial<Rehearsal>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  await updateDoc(doc(db, "rehearsals", id), limpo);

  /*
   * Relê o documento em vez de confiar no que veio: a gravação pode ser
   * parcial — mudar só o status, por exemplo —, e é o estado final que diz se
   * isto é uma apresentação e a que peça pertence.
   */
  const depois = (await getDocs(query(collection(db, "rehearsals"), where("__name__", "==", id))))
    .docs[0];
  const atual = depois ? comId<Rehearsal>(depois) : null;
  if (atual?.tipo === "apresentacao") await sincronizarApresentacaoNaPeca(atual.playId);
}

/**
 * Apaga o ensaio e as presenças que estavam embaixo dele.
 *
 * Apagar um documento no Firestore **não** apaga a subcoleção dele: as
 * presenças continuavam existindo em `rehearsals/{id}/presencas/*`, presas a
 * um ensaio que ninguém mais consegue abrir. Não apareciam em lugar nenhum e
 * não tinham como ser apagadas depois, porque o caminho até elas passa pelo id
 * de um ensaio que sumiu da lista.
 *
 * As presenças vão primeiro, o ensaio por último. Na ordem inversa, uma falha
 * no meio deixaria exatamente os órfãos que isto existe para evitar; nesta,
 * deixa um ensaio sem presenças, que é visível e refazível.
 */
export async function removerEnsaio(id: string): Promise<void> {
  const antes = (await getDocs(query(collection(db, "rehearsals"), where("__name__", "==", id))))
    .docs[0];
  const encontro = antes ? comId<Rehearsal>(antes) : null;

  const presencas = await getDocs(collection(db, "rehearsals", id, "presencas"));
  if (!presencas.empty) {
    const lote = writeBatch(db);
    presencas.docs.forEach((presenca) => lote.delete(presenca.ref));
    await lote.commit();
  }
  await deleteDoc(doc(db, "rehearsals", id));
  if (encontro?.tipo === "apresentacao") await sincronizarApresentacaoNaPeca(encontro.playId);
}
