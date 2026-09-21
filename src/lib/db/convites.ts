import {
  collection,
  deleteDoc,
  doc,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db, getDocs } from "./firestore";
import { gerarCodigo } from "../convite";
import type {
  Convite,
  Person,
} from "../types";

/* ---------------------------------------------------------------- convites */

/**
 * Gera o convite de primeiro acesso de uma pessoa.
 *
 * O id do documento é o próprio código, então dois convites não podem nascer
 * iguais: a regra só aceita `create`, e um código repetido bate em documento
 * existente. Nesse caso sorteia outro — em 25^8 combinações isso não deve
 * acontecer, mas o custo de tratar é uma repetição de laço.
 */
export async function criarConvite(
  pessoa: Person,
  criadoPor: string,
  diasDeValidade = 7,
): Promise<Convite> {
  const expira = new Date();
  expira.setDate(expira.getDate() + diasDeValidade);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo();
    const convite: Convite = {
      codigo,
      personId: pessoa.id,
      personNome: pessoa.nome,
      criadoPor,
      criadoEm: new Date().toISOString(),
      expiraEm: expira.toISOString(),
      usadoEm: null,
      usadoPor: null,
    };
    try {
      /*
       * A regra recusa `update`, então isto falha se o código já existir. É a
       * trava contra colisão, e é do servidor: conferir antes com uma leitura
       * deixaria uma janela entre a conferência e a gravação.
       */
      await setDoc(doc(db, "convites", codigo), convite);
      return convite;
    } catch (erro) {
      const codigoDoErro = (erro as { code?: string }).code;
      if (codigoDoErro !== "permission-denied") throw erro;
    }
  }
  throw new Error("Não foi possível gerar um código livre. Tente de novo.");
}

/** Convites de uma pessoa, do mais recente para o mais antigo. */
export async function listarConvitesDaPessoa(personId: string): Promise<Convite[]> {
  const snap = await getDocs(
    query(collection(db, "convites"), where("personId", "==", personId)),
  );
  // Ordena aqui: `where` com `orderBy` exigiria índice composto no Firestore.
  return snap.docs
    .map((d) => d.data() as Convite)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Apaga o convite. Usado para revogar um código que vazou ou se perdeu. */
export async function revogarConvite(codigo: string): Promise<void> {
  await deleteDoc(doc(db, "convites", codigo));
}
