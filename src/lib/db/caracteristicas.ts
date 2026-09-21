import {
  collection,
  deleteField,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, getDocs, getDoc, comId } from "./firestore";
import type {
  Trait,
} from "../types";

/* --------------------------------------------------------- características */

/*
 * As características de atuação são avaliação que a direção faz das pessoas, e
 * ficam fora dos documentos que o elenco lê.
 *
 * Antes moravam em `people/{id}.caracteristicas` e
 * `characters/{id}.caracteristicasDesejadas`. Esconder as duas seções da
 * interface do participante não bastava: as regras liberam `people` e
 * `characters` para qualquer autenticado, então quem abrisse as ferramentas do
 * navegador alcançava a avaliação de todo mundo. Não dá para simplesmente
 * fechar essas coleções — o participante precisa delas para ver nomes em
 * convocação, presença e elenco.
 *
 * Por isso a atribuição vive num único documento só de administradores. Um
 * documento em vez de uma subcoleção por pessoa porque a tabela de Pessoas
 * mostra as marcações de todo o grupo de uma vez: assim é uma leitura, não uma
 * por integrante.
 */
const REF_ATRIBUICOES = () => doc(db, "direcao", "caracteristicas");

export interface CaracteristicasAtribuidas {
  /** personId → ids de traits. */
  pessoas: Record<string, string[]>;
  /** characterId → ids de traits desejadas no papel. */
  papeis: Record<string, string[]>;
}

const SEM_ATRIBUICOES: CaracteristicasAtribuidas = { pessoas: {}, papeis: {} };

/**
 * As características que a direção atribuiu a pessoas e a papéis.
 *
 * Falha **não** vira lista vazia. A versão anterior engolia qualquer erro e
 * devolvia vazio, para o caso de um participante chamar — só que quem chama
 * são três telas atrás de `apenasAdmin`, e participante nenhum passa por aqui.
 * O que o `catch` fazia de fato era transformar uma oscilação de rede em
 * "esta pessoa não tem característica nenhuma": a tela abria com tudo
 * desmarcado e o próximo Salvar gravava esse vazio por cima da avaliação da
 * direção, sem erro e sem volta.
 *
 * Agora o erro sobe. A tela mostra o estado de falha, e não há o que salvar
 * por cima do que não foi lido.
 *
 * Documento ausente continua sendo vazio legítimo: significa que ainda não
 * houve atribuição nenhuma, que é diferente de não ter conseguido ler.
 */
export async function buscarCaracteristicasAtribuidas(): Promise<CaracteristicasAtribuidas> {
  const snap = await getDoc(REF_ATRIBUICOES());
  if (!snap.exists()) return SEM_ATRIBUICOES;
  const dados = snap.data() as Partial<CaracteristicasAtribuidas>;
  return { pessoas: dados.pessoas ?? {}, papeis: dados.papeis ?? {} };
}

/**
 * Grava a atribuição de uma pessoa ou de um papel.
 *
 * `setDoc` com merge e caminho pontilhado toca só a chave daquele id, então
 * duas telas da direção editando ao mesmo tempo não se sobrescrevem.
 */
async function definirAtribuicao(
  grupo: "pessoas" | "papeis",
  id: string,
  ids: string[],
): Promise<void> {
  await setDoc(REF_ATRIBUICOES(), { [grupo]: { [id]: ids } }, { merge: true });
}

export function definirCaracteristicasDaPessoa(personId: string, ids: string[]): Promise<void> {
  return definirAtribuicao("pessoas", personId, ids);
}

export function definirCaracteristicasDoPapel(characterId: string, ids: string[]): Promise<void> {
  return definirAtribuicao("papeis", characterId, ids);
}

/**
 * Esquece as características de um papel apagado.
 *
 * As atribuições moram fora do documento do personagem — num único documento
 * que só a direção lê —, então apagar o personagem não levava as dela. Cada
 * remoção deixava uma entrada apontando para um id que não existe mais, para
 * sempre. Não quebra nada, mas é lixo que só cresce.
 *
 * O caminho pontilhado apaga a chave daquele id sem reescrever o resto do
 * documento. Falha em silêncio quando não há documento: aí não há o que
 * esquecer, e não é motivo para a remoção do personagem falhar.
 */
export async function esquecerCaracteristicasDoPapel(characterId: string): Promise<void> {
  try {
    await updateDoc(REF_ATRIBUICOES(), { [`papeis.${characterId}`]: deleteField() });
  } catch {
    // Documento inexistente ou sem a chave: nada a fazer.
  }
}

/** Mescla a atribuição nos objetos que as telas da direção já esperam. */
export function comCaracteristicas<T extends { id: string }>(
  itens: T[],
  mapa: Record<string, string[]>,
  campo: "caracteristicas" | "caracteristicasDesejadas",
): T[] {
  return itens.map((item) => ({ ...item, [campo]: mapa[item.id] ?? [] }));
}

export async function listarCaracteristicas(): Promise<Trait[]> {
  const snap = await getDocs(query(collection(db, "traits"), orderBy("ordem")));
  return snap.docs.map((d) => comId<Trait>(d));
}

export async function criarCaracteristica(nome: string, ordem: number): Promise<string> {
  const ref = doc(collection(db, "traits"));
  await setDoc(ref, { nome, ordem, ativo: true });
  return ref.id;
}
