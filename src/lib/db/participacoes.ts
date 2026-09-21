import {
  collection,
  query,
  where,
} from "firebase/firestore";
import { db, getDocs, comId } from "./firestore";
import type {
  Participation,
} from "../types";

/* ----------------------------------------------------------- participações */

export async function listarParticipacoes(personId: string): Promise<Participation[]> {
  const snap = await getDocs(
    query(collection(db, "participations"), where("personId", "==", personId)),
  );
  return snap.docs
    .map((d) => comId<Participation>(d))
    .sort((a, b) => (b.periodo ?? "").localeCompare(a.periodo ?? ""));
}

export async function listarTodasParticipacoes(): Promise<Participation[]> {
  const snap = await getDocs(collection(db, "participations"));
  return snap.docs.map((d) => comId<Participation>(d));
}
