import {
  arrayUnion,
  collection,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, getDocs, getDoc } from "./firestore";
import type {
  UserAccount,
} from "../types";

/* ------------------------------------------------------------------ contas */

export async function buscarConta(uid: string): Promise<UserAccount | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserAccount) : null;
}

/**
 * Guarda o token de push do aparelho na conta. `arrayUnion` evita duplicar
 * quando a pessoa reabre o app no mesmo aparelho.
 */
export async function salvarTokenFcm(uid: string, token: string): Promise<void> {
  await setDoc(doc(db, "users", uid), { tokensFcm: arrayUnion(token) }, { merge: true });
}

export async function salvarConta(conta: UserAccount): Promise<void> {
  const { uid, ...dados } = conta;
  await setDoc(doc(db, "users", uid), dados, { merge: true });
}

/**
 * Todas as contas de acesso. Só a direção lê a coleção inteira.
 *
 * Serve para a tela de vínculo: é a lista de quem tem acesso, com ou sem
 * pessoa ligada.
 */
export async function listarContas(): Promise<UserAccount[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as UserAccount)
    .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
}

/**
 * Liga (ou desliga) uma conta de acesso a uma pessoa do cadastro.
 *
 * É o passo que faz a pessoa ver o próprio histórico, personagem e ensaios.
 * Passar `null` desfaz o vínculo — necessário quando alguém é ligado à pessoa
 * errada, que é justamente o risco que o vínculo automático corria.
 */
export async function vincularContaAPessoa(
  uid: string,
  personId: string | null,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { personId });
}
