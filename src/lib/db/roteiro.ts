import {
  collection,
  deleteDoc,
  doc,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, contar, comId } from "./firestore";
import { hojeISO } from "../format";
import type {
  LineKind,
  Play,
  ScriptLine,
} from "../types";

/* ----------------------------------------------------------------- roteiro */

export async function listarFalas(playId: string): Promise<ScriptLine[]> {
  const snap = await getDocs(collection(db, "plays", playId, "lines"));
  return snap.docs
    .map((d) => comId<ScriptLine>(d))
    .sort((a, b) => a.ato - b.ato || a.cena - b.cena || a.ordem - b.ordem);
}


/**
 * Quantas falas o roteiro tem, sem trazer o roteiro.
 *
 * O painel da direção mostra esse número e mais nada do roteiro. Enquanto a
 * peça atual está sem falas cadastradas dá no mesmo; num roteiro de verdade,
 * com centenas de falas, abrir o painel baixava o texto inteiro para escrever
 * um número na tela.
 */
export async function contarFalas(playId: string): Promise<number> {
  return contar(query(collection(db, "plays", playId, "lines")));
}

export async function criarFala(
  playId: string,
  dados: Omit<ScriptLine, "id" | "playId">,
): Promise<string> {
  const ref = doc(collection(db, "plays", playId, "lines"));
  await setDoc(ref, { ...dados, playId });
  return ref.id;
}

export async function atualizarFala(
  playId: string,
  id: string,
  dados: Partial<ScriptLine>,
): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  delete limpo.playId;
  await updateDoc(doc(db, "plays", playId, "lines", id), limpo);
}

export async function removerFala(playId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "plays", playId, "lines", id));
}

/** Reescreve o campo `ordem` das falas na sequência recebida. */
export async function reordenarFalas(playId: string, falas: ScriptLine[]): Promise<void> {
  const lote = writeBatch(db);
  let mudou = false;
  falas.forEach((fala, indice) => {
    if (fala.ordem !== indice) {
      lote.update(doc(db, "plays", playId, "lines", fala.id), { ordem: indice });
      mudou = true;
    }
  });
  if (mudou) await lote.commit();
}

/**
 * Publica o roteiro para os participantes. A primeira publicação mantém a
 * versão 1; as seguintes incrementam o número da versão.
 */
export async function publicarRoteiro(
  playId: string,
  peca: Play,
  totais: { falas: number; cenas: number },
): Promise<void> {
  await updateDoc(doc(db, "plays", playId), {
    roteiroPublicado: true,
    roteiroVersao: peca.roteiroPublicado ? peca.roteiroVersao + 1 : peca.roteiroVersao,
    roteiroPublicadoEm: hojeISO(),
    // Guardados na publicação para as telas do participante não precisarem
    // varrer o roteiro só para saber o tamanho dele.
    totalFalas: totais.falas,
    totalCenas: totais.cenas,
  });
}

/**
 * Grava de uma vez o roteiro lido de um arquivo.
 *
 * Em lotes de 400 porque o Firestore aceita 500 gravações por lote, e um
 * roteiro de peça grande passa disso com folga. Cada lote é atômico por si; se
 * um falhar no meio, os anteriores ficam — por isso `substituir` limpa antes,
 * e não depois: a alternativa era terminar com meio roteiro novo misturado com
 * o antigo, e ninguém conseguiria dizer onde um acaba e o outro começa.
 *
 * `mapa` já vem resolvido pela tela: nome escrito no roteiro → ids de
 * personagem. O analisador não adivinha personagem, e esta função tampouco —
 * quem casa os nomes é a direção, que sabe que "Principal" é a Amanda.
 */
export async function importarRoteiro(
  playId: string,
  linhas: {
    ato: number;
    cena: number;
    cenaTitulo: string;
    tipo: LineKind;
    quem: string;
    texto: string;
  }[],
  mapa: Record<string, { ids: string[]; nomes: string[] }>,
  { substituir }: { substituir: boolean },
): Promise<{ gravadas: number; apagadas: number }> {
  let apagadas = 0;
  if (substituir) {
    const existentes = await getDocs(collection(db, "plays", playId, "lines"));
    for (let i = 0; i < existentes.docs.length; i += 400) {
      const lote = writeBatch(db);
      existentes.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    apagadas = existentes.size;
  }

  /* A ordem é dentro da cena, e é a ordem em que as linhas foram lidas. */
  const ordemPorCena = new Map<string, number>();

  for (let i = 0; i < linhas.length; i += 400) {
    const lote = writeBatch(db);
    for (const linha of linhas.slice(i, i + 400)) {
      const chave = `${linha.ato}-${linha.cena}`;
      const ordem = ordemPorCena.get(chave) ?? 0;
      ordemPorCena.set(chave, ordem + 1);
      const quem = linha.tipo === "fala" ? (mapa[linha.quem] ?? { ids: [], nomes: [] }) : null;
      lote.set(doc(collection(db, "plays", playId, "lines")), {
        playId,
        ato: linha.ato,
        atoTitulo: "",
        cena: linha.cena,
        cenaTitulo: linha.cenaTitulo,
        ordem,
        tipo: linha.tipo,
        characterIds: quem?.ids ?? [],
        characterNomes: quem?.nomes ?? [],
        texto: linha.texto,
      });
    }
    await lote.commit();
  }

  await marcarRoteiroEditado(playId);
  return { gravadas: linhas.length, apagadas };
}

/** Registra a hora da última alteração no rascunho do roteiro. */
export async function marcarRoteiroEditado(playId: string): Promise<void> {
  await updateDoc(doc(db, "plays", playId), { roteiroEditadoEm: new Date().toISOString() });
}

/**
 * Renomeia ato e cena em todas as linhas correspondentes. Os títulos vivem
 * repetidos nas linhas para o roteiro caber em uma leitura só, sem uma
 * coleção separada de atos e cenas.
 */
export async function renomearCena(
  playId: string,
  ato: number,
  cena: number,
  dados: { atoTitulo?: string; cenaTitulo?: string },
): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "lines"), where("ato", "==", ato)),
  );
  const alvos = snap.docs.filter(
    (d) => dados.cenaTitulo === undefined || d.data().cena === cena,
  );
  if (alvos.length === 0) return;
  const lote = writeBatch(db);
  alvos.forEach((d) => {
    const campos: Record<string, string> = {};
    if (dados.atoTitulo !== undefined) campos.atoTitulo = dados.atoTitulo;
    if (dados.cenaTitulo !== undefined && d.data().cena === cena) {
      campos.cenaTitulo = dados.cenaTitulo;
    }
    if (Object.keys(campos).length > 0) lote.update(d.ref, campos);
  });
  await lote.commit();
}

/** Renomeia o personagem nas falas já cadastradas, mantendo o roteiro coerente. */
export async function renomearPersonagemNasFalas(
  playId: string,
  characterId: string,
  nome: string,
): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "lines"), where("characterId", "==", characterId)),
  );
  if (snap.empty) return;
  const lote = writeBatch(db);
  snap.docs.forEach((d) => lote.update(d.ref, { characterNome: nome }));
  await lote.commit();
}
