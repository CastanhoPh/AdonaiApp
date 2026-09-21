import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, comId } from "./firestore";
import type {
  Aviso,
} from "../types";

/* ------------------------------------------------------------------ avisos */

/** Enfileira um aviso. Quem entrega é o disparador, fora do navegador. */
export async function criarAviso(
  dados: Omit<Aviso, "id" | "criadoEm" | "status" | "enviadoEm" | "detalhe" | "entregues">,
): Promise<string> {
  const ref = doc(collection(db, "avisos"));
  await setDoc(ref, {
    ...dados,
    criadoEm: new Date().toISOString(),
    status: "pendente",
    enviadoEm: "",
    detalhe: "",
    entregues: 0,
  });
  return ref.id;
}

/** Avisos mais recentes primeiro. */
export async function listarAvisos(quantos = 20): Promise<Aviso[]> {
  const snap = await getDocs(
    query(collection(db, "avisos"), orderBy("criadoEm", "desc"), limit(quantos)),
  );
  return snap.docs.map((d) => comId<Aviso>(d));
}

/**
 * Apaga um aviso do histórico.
 *
 * Não desfaz entrega: notificação que já saiu está no aparelho de quem
 * recebeu, e nada no servidor a recolhe. Isto limpa o registro na tela.
 *
 * Aviso automático apagado não volta: o ensaio guarda `lembreteEm`, que é a
 * trava contra repetição, e ela continua valendo.
 */
export async function removerAviso(id: string): Promise<void> {
  await deleteDoc(doc(db, "avisos", id));
}

/**
 * Apaga todos os avisos e devolve quantos foram.
 *
 * Em lotes de 400 porque o limite de uma escrita em lote do Firestore é 500.
 */
export async function removerTodosOsAvisos(): Promise<number> {
  const snap = await getDocs(collection(db, "avisos"));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const lote = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
    await lote.commit();
  }
  return snap.size;
}
