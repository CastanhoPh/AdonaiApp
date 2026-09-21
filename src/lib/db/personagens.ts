import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, getDoc, getDocs, comId } from "./firestore";
import { hojeISO } from "../format";
import {
  definirCaracteristicasDoPapel,
  esquecerCaracteristicasDoPapel,
} from "./caracteristicas";
import type {
  Character,
  Participation,
  Play,
} from "../types";

/* ------------------------------------------------------------- personagens */

export async function listarPersonagens(playId: string): Promise<Character[]> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "characters"), orderBy("ordem")),
  );
  return snap.docs.map((d) => comId<Character>(d));
}

/**
 * Todos os papéis da pessoa na peça. Vazio quando ela não está escalada.
 *
 * Antes escalar uma pessoa retirava ela de qualquer outro personagem da mesma
 * peça — uma pessoa, um papel. A regra fazia sentido para produção em
 * andamento, e não serve para o acervo: acumular papéis é comum, e em "A
 * Resposta" a mesma pessoa fez assistente, guerreiro e narrador. Com a regra
 * antiga, dois desses três desapareciam sem aviso ao serem cadastrados.
 *
 * Ordenado por `ordem`, então o primeiro é o papel mais relevante da peça —
 * é ele que a interface mostra quando só cabe um.
 */
export async function listarPersonagensDaPessoa(
  playId: string,
  personId: string,
): Promise<Character[]> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "characters"), where("personId", "==", personId)),
  );
  // Ordena aqui: `where` com `orderBy` exigiria índice composto no Firestore.
  return snap.docs.map((d) => comId<Character>(d)).sort((a, b) => a.ordem - b.ordem);
}


export async function criarPersonagem(
  playId: string,
  dados: Omit<Character, "id" | "playId">,
): Promise<string> {
  const { caracteristicasDesejadas, ...doDocumento } = dados;
  const ref = doc(collection(db, "plays", playId, "characters"));
  await setDoc(ref, { ...doDocumento, playId });
  if (caracteristicasDesejadas?.length) {
    await definirCaracteristicasDoPapel(ref.id, caracteristicasDesejadas);
  }
  return ref.id;
}

export async function atualizarPersonagem(
  playId: string,
  id: string,
  dados: Partial<Character>,
): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  delete limpo.playId;
  const desejadas = limpo.caracteristicasDesejadas;
  delete limpo.caracteristicasDesejadas;
  if (Object.keys(limpo).length > 0) {
    await updateDoc(doc(db, "plays", playId, "characters", id), limpo);
  }
  if (desejadas) await definirCaracteristicasDoPapel(id, desejadas);
}

export async function removerPersonagem(playId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "plays", playId, "characters", id));
  await esquecerCaracteristicasDoPapel(id);
}

/**
 * Escala (ou desescala) uma pessoa em um personagem. Como cada personagem
 * aceita apenas uma pessoa por vez, a pessoa é retirada de qualquer outro
 * personagem da mesma peça antes de ser vinculada.
 */
/**
 * Põe (ou tira) alguém num personagem.
 *
 * Quando a peça já está encerrada, o histórico é escrito na hora.
 *
 * O histórico nasce no momento de concluir a peça, e isso cobre a produção que
 * anda pelo app do começo ao fim. Não cobre o que a direção faz de verdade com
 * o acervo: lembrar de alguém que fez um papel numa peça de anos atrás,
 * cadastrar o personagem e escalar. A peça já foi concluída, o momento de
 * gravar o histórico já passou, e a pessoa ficava fora do próprio histórico —
 * sem erro nenhum, e sem ninguém perceber até contar as peças de alguém.
 *
 * Tirar a pessoa de um papel de peça encerrada apaga a participação
 * correspondente, senão o histórico afirmaria algo que a escalação desmente.
 */
export async function escalarPessoa(
  playId: string,
  characterId: string,
  personId: string | null,
  personNome: string,
): Promise<void> {
  const referencia = doc(db, "plays", playId, "characters", characterId);
  const antes = (await getDoc(referencia)).data() as Character | undefined;

  await updateDoc(referencia, {
    personId,
    personNome: personId ? personNome : "",
    situacao: personId ? "confirmado" : "pendente",
  });

  const peca = (await getDoc(doc(db, "plays", playId))).data() as Play | undefined;
  if (!peca || !["concluida", "arquivada"].includes(peca.status)) return;

  // Saiu do papel, ou trocou de pessoa: a participação de quem estava some.
  if (antes?.personId && antes.personId !== personId) {
    const anteriores = await getDocs(
      query(
        collection(db, "participations"),
        where("playId", "==", playId),
        where("characterId", "==", characterId),
      ),
    );
    await Promise.all(anteriores.docs.map((d) => deleteDoc(d.ref)));
  }

  if (!personId || antes?.personId === personId) return;

  const personagem = (await getDoc(referencia)).data() as Character;
  const participacao: Omit<Participation, "id"> = {
    personId,
    playId,
    playTitulo: peca.titulo,
    playEvento: peca.nomeEvento ?? "",
    playCapaUrl: peca.capaUrl ?? "",
    characterId,
    characterNome: personagem.nome,
    tipoPapel: personagem.tipoPapel,
    periodo: peca.dataApresentacao || hojeISO(),
    concluidaEm: new Date().toISOString(),
  };
  await setDoc(doc(collection(db, "participations")), participacao);
}
