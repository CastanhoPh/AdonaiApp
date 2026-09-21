import {
  collection,
  doc,
  setDoc,
} from "firebase/firestore";
import { db, getDocs, getDoc } from "./firestore";
import type {
  Presenca,
  PresencaEstado,
} from "../types";

/* ---------------------------------------------------------------- presenças */

/** Respostas de presença de um ensaio, na ordem dos nomes. */
export async function listarPresencas(rehearsalId: string): Promise<Presenca[]> {
  const snap = await getDocs(collection(db, "rehearsals", rehearsalId, "presencas"));
  return snap.docs
    .map((d) => ({ ...(d.data() as Presenca), personId: d.id }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarPresenca(
  rehearsalId: string,
  personId: string,
): Promise<Presenca | null> {
  const snap = await getDoc(doc(db, "rehearsals", rehearsalId, "presencas", personId));
  return snap.exists() ? ({ ...(snap.data() as Presenca), personId: snap.id }) : null;
}

/**
 * Registra a resposta de presença. O id do documento é o da pessoa, o que faz
 * a resposta ser idempotente: responder de novo substitui a anterior.
 */
export async function salvarPresenca(
  rehearsalId: string,
  personId: string,
  nome: string,
  estado: PresencaEstado,
  justificativa = "",
): Promise<void> {
  await setDoc(doc(db, "rehearsals", rehearsalId, "presencas", personId), {
    nome,
    estado,
    justificativa: justificativa.trim(),
    atualizadoEm: new Date().toISOString(),
  });
}
