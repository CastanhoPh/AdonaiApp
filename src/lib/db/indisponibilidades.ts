import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db, getDocs, comId } from "./firestore";
import type { Indisponibilidade } from "../types";

/* ------------------------------------------------------ indisponibilidades */

/**
 * Quando cada um já avisou que não pode.
 *
 * A confirmação de presença é reativa: a direção marca o ensaio, o elenco
 * responde, e aí se descobre que metade não pode — e remarca. Avisar antes
 * inverte isso, e remarcação é o que mais custa a um grupo que ensaia à noite,
 * de graça, no meio da semana.
 */

/**
 * O que a pessoa já avisou. Passado fica fora: não serve para marcar nada.
 *
 * Filtra por pessoa no servidor e por data aqui. Somar as duas na consulta
 * exigiria índice composto — e cada um tem um punhado de avisos, não milhares:
 * o índice custaria manutenção e uma espera de construção a cada projeto novo
 * para poupar o descarte de três documentos.
 */
export async function listarIndisponibilidadesDaPessoa(
  personId: string,
  desde: string,
): Promise<Indisponibilidade[]> {
  const snap = await getDocs(
    query(collection(db, "indisponibilidades"), where("personId", "==", personId)),
  );
  return snap.docs
    .map((d) => comId<Indisponibilidade>(d))
    .filter((a) => a.ate >= desde)
    .sort((a, b) => a.de.localeCompare(b.de));
}

/**
 * Tudo que ainda vale, para a direção montar a agenda.
 *
 * Filtra só por `ate >= hoje` e o resto é peneirado na tela. O Firestore não
 * aceita faixa em dois campos na mesma consulta, e a alternativa — índice
 * composto e consulta por dia — custaria uma ida ao banco por data que a
 * direção experimentasse. São dezenas de documentos: cabe de uma vez.
 */
export async function listarIndisponibilidades(desde: string): Promise<Indisponibilidade[]> {
  const snap = await getDocs(
    query(collection(db, "indisponibilidades"), where("ate", ">=", desde), orderBy("ate")),
  );
  return snap.docs.map((d) => comId<Indisponibilidade>(d)).sort((a, b) => a.de.localeCompare(b.de));
}

export async function avisarIndisponibilidade(
  dados: Omit<Indisponibilidade, "id" | "criadoEm">,
): Promise<string> {
  const ref = doc(collection(db, "indisponibilidades"));
  await setDoc(ref, { ...dados, criadoEm: new Date().toISOString() });
  return ref.id;
}

export async function removerIndisponibilidade(id: string): Promise<void> {
  await deleteDoc(doc(db, "indisponibilidades", id));
}

/** Quem não pode num dia, entre os avisos que já existem. */
export function quemNaoPodeEm(avisos: Indisponibilidade[], dia: string): Indisponibilidade[] {
  return avisos.filter((a) => a.de <= dia && dia <= a.ate);
}
