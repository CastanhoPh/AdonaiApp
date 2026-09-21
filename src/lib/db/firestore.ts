/**
 * O acesso cru ao Firestore, compartilhado pelos módulos de `db/`.
 *
 * Aqui moram as três decisões que valem para todo mundo — o que pode vir do
 * disco, o que não pode, e o que nem precisa vir. Cada módulo de assunto
 * importa daqui em vez de falar com o SDK direto, senão a decisão vira
 * convenção que alguém esquece.
 */
import {
  getDoc as getDocDoSdk,
  getDocFromCache,
  getDocs as getDocsDoSdk,
  getCountFromServer,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export { db } from "../firebase";

/*
 * Consulta de coleção vai ao servidor. Não use cache-first aqui.
 *
 * Uma versão anterior respondia do cache em disco quando ele não estava vazio,
 * para a tela pintar antes da ida e volta. O defeito: `getDocsFromCache`
 * devolve o que existe localmente, e "existe algo" não é o mesmo que "existe
 * tudo". Basta uma leitura anterior de documento único da mesma coleção para o
 * cache ter uma parte dela — e a consulta devolvia essa parte como se fosse o
 * conjunto completo.
 *
 * Foi exatamente o que aconteceu com `listarContas`: o login lê `users/{uid}`
 * individualmente, então a listagem de contas voltava com uma conta só e a
 * fila de vínculos parecia vazia. Silencioso, sem erro nenhum, e valia para
 * qualquer coleção — pessoa, peça, ensaio.
 *
 * O cache em disco continua valendo a pena: o Firestore reusa o que tem, manda
 * token de retomada e devolve só o que mudou, além de sustentar a releitura
 * offline. O que não dá é decidir por conta própria que o cache está completo.
 */
export const getDocs = getDocsDoSdk;

/*
 * Documento único pode vir do disco: aqui "existe" é resposta completa, não um
 * pedaço dela — é um documento, não um conjunto. A releitura no servidor segue
 * por trás para deixar o disco em dia.
 */
export async function getDoc<T>(
  referencia: DocumentReference<T>,
): Promise<DocumentSnapshot<T>> {
  try {
    const doDisco = await getDocFromCache(referencia);
    if (doDisco.exists()) {
      void getDocDoSdk(referencia).catch(() => {});
      return doDisco;
    }
  } catch {
    // Documento ainda não está no disco: busca normal.
  }
  return getDocDoSdk(referencia);
}

/*
 * Quantos são, sem trazer quais são.
 *
 * O Firestore responde o número no servidor: a resposta é o número, não os
 * documentos. Para uma tela que só mostra o total — o painel da direção mostra
 * quantas falas o roteiro tem — é a diferença entre baixar o roteiro inteiro e
 * baixar um inteiro. Também conta como uma leitura a cada mil documentos na
 * fatura, em vez de uma por documento.
 *
 * Vai sempre ao servidor, não tem versão de cache, e é por isso que só serve
 * para número solto: onde a tela precisa dos documentos, `getDocs` continua
 * sendo o caminho.
 */
export async function contar(
  consulta: Parameters<typeof getCountFromServer>[0],
): Promise<number> {
  const resposta = await getCountFromServer(consulta);
  return resposta.data().count;
}

/** O id do documento junto com os campos, que é como as telas esperam. */
export function comId<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T;
}
