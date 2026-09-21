import {
  doc,
  setDoc,
} from "firebase/firestore";
import { db, getDoc } from "./firestore";
import type {
  ContatoPessoal,
  Person,
} from "../types";

/* ------------------------------------------------------ contato pessoal */

/**
 * Telefone, nascimento e responsável — o que só a direção e a própria pessoa
 * enxergam.
 *
 * Fica fora de `people` porque aquele documento é lido por todo o elenco para
 * montar a lista de elenco. Buscar é uma leitura a mais, então só as telas que
 * mostram esses campos pagam: o Perfil da própria pessoa e a ficha na direção.
 */
function refDoContato(personId: string) {
  return doc(db, "people", personId, "privado", "contato");
}

const SEM_CONTATO: ContatoPessoal = { telefone: "" };

export async function buscarContato(personId: string): Promise<ContatoPessoal> {
  const snap = await getDoc(refDoContato(personId));
  if (!snap.exists()) return SEM_CONTATO;
  const d = snap.data() as Partial<ContatoPessoal>;
  return {
    telefone: d.telefone ?? "",
    nascimento: d.nascimento,
    responsavelNome: d.responsavelNome,
    responsavelTelefone: d.responsavelTelefone,
  };
}

/** Grava só o que veio; o resto do documento fica como está. */
export async function salvarContato(
  personId: string,
  dados: Partial<ContatoPessoal>,
): Promise<void> {
  /*
   * Campo ausente é ausente, não é `undefined`.
   *
   * O Firestore recusa `undefined` com exceção (o projeto não liga
   * `ignoreUndefinedProperties`, de propósito: gravar silenciosamente um campo
   * que virou `undefined` por engano é pior que o erro). Quem chama monta o
   * objeto com todos os campos possíveis e deixa de fora os que não tem, então
   * a limpeza mora aqui — e, com `merge`, deixar de fora preserva o que já
   * estava gravado.
   */
  const preenchidos = Object.fromEntries(
    Object.entries(dados).filter(([, valor]) => valor !== undefined),
  );
  if (Object.keys(preenchidos).length === 0) return;
  await setDoc(refDoContato(personId), preenchidos, { merge: true });
}

/** Junta a ficha com o contato, para a tela receber tudo num objeto só. */
export async function comContato(pessoa: Person): Promise<Person> {
  const contato = await buscarContato(pessoa.id);
  // `email` sobe um nível: as telas o tratam como campo da pessoa, e era ali
  // que ele morava antes de sair da ficha pública.
  return { ...pessoa, contato, email: contato.email ?? "" };
}
