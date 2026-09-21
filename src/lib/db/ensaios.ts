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
import type {
  Rehearsal,
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


export async function criarEnsaio(dados: Omit<Rehearsal, "id">): Promise<string> {
  const ref = doc(collection(db, "rehearsals"));
  await setDoc(ref, dados);
  return ref.id;
}

export async function atualizarEnsaio(id: string, dados: Partial<Rehearsal>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  await updateDoc(doc(db, "rehearsals", id), limpo);
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
  const presencas = await getDocs(collection(db, "rehearsals", id, "presencas"));
  if (!presencas.empty) {
    const lote = writeBatch(db);
    presencas.docs.forEach((presenca) => lote.delete(presenca.ref));
    await lote.commit();
  }
  await deleteDoc(doc(db, "rehearsals", id));
}
