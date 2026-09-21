import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, comId } from "./firestore";
import type {
  Exercise,
} from "../types";

/* -------------------------------------------------------------- exercícios */

/** Na ordem em que a direção quer que sejam feitos. */
export async function listarExercicios(): Promise<Exercise[]> {
  const snap = await getDocs(query(collection(db, "exercicios"), orderBy("ordem")));
  return snap.docs.map((d) => comId<Exercise>(d));
}

export async function criarExercicio(
  dados: Omit<Exercise, "id" | "criadoEm" | "ordem">,
  ordem: number,
): Promise<string> {
  const ref = doc(collection(db, "exercicios"));
  await setDoc(ref, { ...dados, ordem, criadoEm: new Date().toISOString() });
  return ref.id;
}

export async function atualizarExercicio(
  id: string,
  dados: Partial<Omit<Exercise, "id">>,
): Promise<void> {
  const limpo = { ...dados };
  delete (limpo as { id?: string }).id;
  await updateDoc(doc(db, "exercicios", id), limpo);
}

export async function removerExercicio(id: string): Promise<void> {
  await deleteDoc(doc(db, "exercicios", id));
}

/**
 * Troca um exercício de lugar com o vizinho.
 *
 * A ordem é a informação principal da lista — é a sequência do aquecimento —,
 * e reordenar arrastando não funciona bem no celular, que é onde o elenco
 * abre o app. Duas setas resolvem, e a troca de `ordem` entre os dois vizinhos
 * mantém a numeração sem renumerar a lista inteira.
 */
export async function trocarOrdemDoExercicio(
  a: Exercise,
  b: Exercise,
): Promise<void> {
  const lote = writeBatch(db);
  lote.update(doc(db, "exercicios", a.id), { ordem: b.ordem });
  lote.update(doc(db, "exercicios", b.id), { ordem: a.ordem });
  await lote.commit();
}
