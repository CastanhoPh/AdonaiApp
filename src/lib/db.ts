/**
 * Camada de acesso ao Firestore. Todas as regras de negócio que envolvem mais de
 * um documento (peça atual, conclusão de peça, escalação) vivem aqui.
 */
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc as getDocDoSdk,
  getDocFromCache,
  getDocs as getDocsDoSdk,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { hojeISO } from "./format";

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
 * Foi exatamente o que aconteceu com `listarContas`: o login lê
 * `users/{uid}` individualmente, então a listagem de contas voltava com uma
 * conta só e a fila de vínculos parecia vazia. Silencioso, sem erro nenhum, e
 * valia para qualquer coleção — pessoa, peça, ensaio.
 *
 * O cache em disco continua valendo a pena: o Firestore reusa o que tem,
 * manda token de retomada e devolve só o que mudou, além de sustentar a
 * releitura offline. O que não dá é decidir por conta própria que o cache
 * está completo.
 */
const getDocs = getDocsDoSdk;

/*
 * Documento único pode vir do disco: aqui "existe" é resposta completa, não
 * um pedaço dela — é um documento, não um conjunto. A releitura no servidor
 * segue por trás para deixar o disco em dia.
 */
async function getDoc<T>(referencia: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
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
import type {
  Aviso,
  Character,
  Participation,
  Person,
  PersonNotes,
  Play,
  Presenca,
  PresencaEstado,
  Rehearsal,
  RoleType,
  ScriptLine,
  Trait,
  UserAccount,
} from "./types";

function comId<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T;
}

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

/* ----------------------------------------------------------------- pessoas */

export async function listarPessoas(): Promise<Person[]> {
  const snap = await getDocs(query(collection(db, "people"), orderBy("nome")));
  return snap.docs.map((d) => comId<Person>(d));
}

export async function buscarPessoa(id: string): Promise<Person | null> {
  const snap = await getDoc(doc(db, "people", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Person) : null;
}

/** Usada no cadastro para vincular a conta à pessoa já registrada pela direção. */
export async function buscarPessoaPorEmail(email: string): Promise<Person | null> {
  const snap = await getDocs(
    query(collection(db, "people"), where("email", "==", email.toLowerCase()), limit(1)),
  );
  const primeiro = snap.docs[0];
  return primeiro ? comId<Person>(primeiro) : null;
}

export async function criarPessoa(dados: Omit<Person, "id" | "criadoEm">): Promise<string> {
  // As características saem do documento da pessoa: veja REF_ATRIBUICOES.
  const { caracteristicas, ...doDocumento } = dados;
  const ref = doc(collection(db, "people"));
  await setDoc(ref, {
    ...doDocumento,
    email: dados.email.toLowerCase(),
    criadoEm: new Date().toISOString(),
  });
  if (caracteristicas?.length) await definirCaracteristicasDaPessoa(ref.id, caracteristicas);
  return ref.id;
}

export async function atualizarPessoa(id: string, dados: Partial<Person>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  // Desviada para o documento da direção, nunca para o da pessoa.
  const caracteristicas = limpo.caracteristicas;
  delete limpo.caracteristicas;
  if (typeof limpo.email === "string") limpo.email = limpo.email.toLowerCase();
  if (Object.keys(limpo).length > 0) await updateDoc(doc(db, "people", id), limpo);
  if (caracteristicas) await definirCaracteristicasDaPessoa(id, caracteristicas);
}

/** Campos que a própria pessoa preenche no cadastro de primeiro acesso. */
export type CadastroDaPessoa = Pick<
  Person,
  | "nome"
  | "telefone"
  | "nascimento"
  | "responsavelNome"
  | "responsavelTelefone"
  | "jaAtuou"
  | "experiencia"
  | "pecasAnteriores"
>;

/**
 * Grava as respostas do cadastro e marca a conclusão. `cadastroCompletoEm`
 * vazio é o que faz o formulário reaparecer no próximo acesso, então ele é
 * escrito junto com os dados, nunca antes.
 */
export async function completarCadastro(
  personId: string,
  dados: CadastroDaPessoa,
): Promise<void> {
  await updateDoc(doc(db, "people", personId), {
    ...dados,
    cadastroCompletoEm: new Date().toISOString(),
  });
}

/** Observações da direção: subcoleção lida apenas por administradores. */
export async function buscarObservacoes(personId: string): Promise<PersonNotes | null> {
  const snap = await getDoc(doc(db, "people", personId, "privado", "direcao"));
  return snap.exists() ? (snap.data() as PersonNotes) : null;
}

export async function salvarObservacoes(personId: string, observacoes: string): Promise<void> {
  await setDoc(doc(db, "people", personId, "privado", "direcao"), {
    observacoes,
    atualizadoEm: new Date().toISOString(),
  });
}

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

/** Só a direção consegue ler; para participante a regra nega e devolve vazio. */
export async function buscarCaracteristicasAtribuidas(): Promise<CaracteristicasAtribuidas> {
  try {
    const snap = await getDoc(REF_ATRIBUICOES());
    if (!snap.exists()) return SEM_ATRIBUICOES;
    const dados = snap.data() as Partial<CaracteristicasAtribuidas>;
    return { pessoas: dados.pessoas ?? {}, papeis: dados.papeis ?? {} };
  } catch {
    return SEM_ATRIBUICOES;
  }
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


/* ------------------------------------------------------------------- peças */

/**
 * Peças da mais recente para a mais antiga, pela data de apresentação.
 *
 * Antes vinham por data de cadastro, o que só coincide com a ordem real
 * enquanto se cadastra na sequência em que as peças acontecem. Ao subir o
 * acervo de uma vez, as treze entraram no mesmo instante e a lista saiu
 * embaralhada — 2024 depois de 2026.
 *
 * A ordenação é feita aqui e não no Firestore para não exigir índice composto
 * nem excluir peça sem data: `orderBy` no servidor descarta documento sem o
 * campo, e peça em planejamento pode não ter data ainda.
 */
export async function listarPecas(): Promise<Play[]> {
  const snap = await getDocs(collection(db, "plays"));
  const pecas = snap.docs.map((d) => comId<Play>(d));
  return pecas.sort((a, b) => {
    // Sem data vai para o topo: é peça sendo montada agora.
    const x = a.dataApresentacao || "9999-12-31";
    const y = b.dataApresentacao || "9999-12-31";
    if (x !== y) return y.localeCompare(x);
    return (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
  });
}

export async function buscarPeca(id: string): Promise<Play | null> {
  const snap = await getDoc(doc(db, "plays", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Play) : null;
}

/** Apenas uma peça é a atual; a consulta devolve a primeira marcada. */
export async function buscarPecaAtual(): Promise<Play | null> {
  const snap = await getDocs(query(collection(db, "plays"), where("atual", "==", true), limit(1)));
  const primeiro = snap.docs[0];
  return primeiro ? comId<Play>(primeiro) : null;
}

/** Campos que quem cria a peça informa; o resto nasce com valor padrão. */
export type NovaPeca = Omit<
  Play,
  "id" | "criadoEm" | "roteiroVersao" | "roteiroPublicado" | "roteiroPublicadoEm" | "roteiroEditadoEm"
>;

export async function criarPeca(dados: NovaPeca): Promise<string> {
  const ref = doc(collection(db, "plays"));
  await setDoc(ref, {
    ...dados,
    atual: false,
    roteiroVersao: 1,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: new Date().toISOString(),
  });
  if (dados.atual) await definirPecaAtual(ref.id);
  return ref.id;
}

export async function atualizarPeca(id: string, dados: Partial<Play>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  delete limpo.atual; // trocar a peça atual passa por definirPecaAtual
  await updateDoc(doc(db, "plays", id), limpo);
}

/**
 * Marca a peça como atual e desmarca todas as outras — garante a regra de que
 * somente uma peça é considerada a peça atual.
 */
export async function definirPecaAtual(id: string): Promise<void> {
  const todas = await getDocs(collection(db, "plays"));
  const lote = writeBatch(db);
  let mudou = false;
  todas.docs.forEach((d) => {
    const deveSerAtual = d.id === id;
    if (Boolean(d.data().atual) !== deveSerAtual) {
      lote.update(d.ref, { atual: deveSerAtual });
      mudou = true;
    }
  });
  if (mudou) await lote.commit();
}

/**
 * Conclui a peça: registra a participação de cada personagem escalado no
 * histórico e deixa de considerá-la a peça atual. Devolve quantas
 * participações novas foram criadas.
 */
export async function concluirPeca(id: string): Promise<number> {
  const peca = await buscarPeca(id);
  if (!peca) throw new Error("Peça não encontrada.");

  const personagens = await listarPersonagens(id);
  const escalados = personagens.filter((p) => p.personId);

  const existentes = await getDocs(
    query(collection(db, "participations"), where("playId", "==", id)),
  );
  const jaRegistrados = new Set(
    existentes.docs.map((d) => `${d.data().personId}:${d.data().characterId}`),
  );

  const lote = writeBatch(db);
  let novos = 0;
  const agora = new Date().toISOString();

  for (const personagem of escalados) {
    const chave = `${personagem.personId}:${personagem.id}`;
    if (jaRegistrados.has(chave)) continue;
    const ref = doc(collection(db, "participations"));
    const participacao: Omit<Participation, "id"> = {
      personId: personagem.personId as string,
      playId: peca.id,
      playTitulo: peca.titulo,
      playEvento: peca.nomeEvento ?? "",
      playCapaUrl: peca.capaUrl ?? "",
      characterId: personagem.id,
      characterNome: personagem.nome,
      tipoPapel: personagem.tipoPapel,
      periodo: peca.dataApresentacao || hojeISO(),
      concluidaEm: agora,
    };
    lote.set(ref, participacao);
    novos += 1;
  }

  lote.update(doc(db, "plays", id), { status: "concluida", atual: false });
  await lote.commit();
  return novos;
}

/** Um personagem da peça antiga e quem o fez. */
export interface PapelAntigo {
  nome: string;
  tipoPapel: RoleType;
  /** Vazio quando não se lembra de quem fez: nada vai para o histórico. */
  personId: string;
  personNome: string;
}

/**
 * Registra no histórico uma peça que já aconteceu.
 *
 * O caminho normal de uma peça é planejamento → escalação → ensaio → conclusão,
 * e é a conclusão que grava a participação de cada um. Para peça antiga esse
 * caminho é só trabalho: ninguém vai ensaiar o que já foi apresentado. Aqui a
 * peça nasce concluída, com os personagens e as participações no mesmo lote —
 * ou tudo entra, ou nada entra, e não fica peça pela metade no histórico.
 *
 * Roteiro e elenco não são exigidos: peça antiga raramente tem o texto à mão, e
 * o elenco de anos atrás costuma ser lembrado depois. Nome, evento e data já
 * têm valor sozinhos — a peça fica registrada e recebe o resto quando der.
 */
export async function registrarPecaAntiga(dados: {
  titulo: string;
  nomeEvento: string;
  dataApresentacao: string;
  local: string;
  descricao: string;
  papeis: PapelAntigo[];
}): Promise<{ playId: string; participacoes: number }> {
  const lote = writeBatch(db);
  const agora = new Date().toISOString();
  const pecaRef = doc(collection(db, "plays"));

  lote.set(pecaRef, {
    titulo: dados.titulo,
    nomeEvento: dados.nomeEvento,
    descricao: dados.descricao,
    capaUrl: "",
    dataApresentacao: dados.dataApresentacao,
    local: dados.local,
    status: "concluida",
    // Nunca a peça atual: já passou, e só uma peça pode ser a atual.
    atual: false,
    roteiroVersao: 0,
    roteiroPublicado: false,
    roteiroPublicadoEm: "",
    roteiroEditadoEm: "",
    criadoEm: agora,
  });

  let participacoes = 0;
  dados.papeis.forEach((papel, ordem) => {
    const personagemRef = doc(collection(db, "plays", pecaRef.id, "characters"));
    lote.set(personagemRef, {
      playId: pecaRef.id,
      nome: papel.nome,
      descricao: "",
      tipoPapel: papel.tipoPapel,
      observacoes: "",
      imagemUrl: "",
      personId: papel.personId || null,
      personNome: papel.personNome,
      situacao: papel.personId ? "confirmado" : "pendente",
      ordem,
    });

    if (!papel.personId) return;
    const participacaoRef = doc(collection(db, "participations"));
    lote.set(participacaoRef, {
      personId: papel.personId,
      playId: pecaRef.id,
      playTitulo: dados.titulo,
      playEvento: dados.nomeEvento,
      playCapaUrl: "",
      characterId: personagemRef.id,
      characterNome: papel.nome,
      tipoPapel: papel.tipoPapel,
      periodo: dados.dataApresentacao,
      concluidaEm: agora,
    });
    participacoes += 1;
  });

  await lote.commit();
  return { playId: pecaRef.id, participacoes };
}

/* ------------------------------------------------------------- personagens */

export async function listarPersonagens(playId: string): Promise<Character[]> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "characters"), orderBy("ordem")),
  );
  return snap.docs.map((d) => comId<Character>(d));
}

/** Personagem da pessoa na peça informada, ou nulo se ela não está escalada. */
export async function buscarPersonagemDaPessoa(
  playId: string,
  personId: string,
): Promise<Character | null> {
  const snap = await getDocs(
    query(
      collection(db, "plays", playId, "characters"),
      where("personId", "==", personId),
      limit(1),
    ),
  );
  const primeiro = snap.docs[0];
  return primeiro ? comId<Character>(primeiro) : null;
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
}

/**
 * Escala (ou desescala) uma pessoa em um personagem. Como cada personagem
 * aceita apenas uma pessoa por vez, a pessoa é retirada de qualquer outro
 * personagem da mesma peça antes de ser vinculada.
 */
export async function escalarPessoa(
  playId: string,
  characterId: string,
  personId: string | null,
  personNome: string,
): Promise<void> {
  const lote = writeBatch(db);

  if (personId) {
    const jaEscalada = await getDocs(
      query(collection(db, "plays", playId, "characters"), where("personId", "==", personId)),
    );
    jaEscalada.docs
      .filter((d) => d.id !== characterId)
      .forEach((d) =>
        lote.update(d.ref, { personId: null, personNome: "", situacao: "pendente" }),
      );
  }

  lote.update(doc(db, "plays", playId, "characters", characterId), {
    personId,
    personNome: personId ? personNome : "",
    situacao: personId ? "confirmado" : "pendente",
  });

  await lote.commit();
}

/* ----------------------------------------------------------------- roteiro */

export async function listarFalas(playId: string): Promise<ScriptLine[]> {
  const snap = await getDocs(collection(db, "plays", playId, "lines"));
  return snap.docs
    .map((d) => comId<ScriptLine>(d))
    .sort((a, b) => a.ato - b.ato || a.cena - b.cena || a.ordem - b.ordem);
}

/**
 * Falas de um personagem só. As telas de Início e Meu personagem precisam
 * apenas destas — baixar o roteiro inteiro para contar "14 falas suas" custa
 * centenas de documentos por abertura de tela.
 */
export async function listarFalasDoPersonagem(
  playId: string,
  characterId: string,
): Promise<ScriptLine[]> {
  const snap = await getDocs(
    query(collection(db, "plays", playId, "lines"), where("characterId", "==", characterId)),
  );
  return snap.docs
    .map((d) => comId<ScriptLine>(d))
    .sort((a, b) => a.ato - b.ato || a.cena - b.cena || a.ordem - b.ordem);
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

/* ----------------------------------------------------------------- ensaios */

/** Ensaios ordenados por data crescente — os mais próximos primeiro. */
export async function listarEnsaios(playId?: string): Promise<Rehearsal[]> {
  const base = collection(db, "rehearsals");
  const snap = await getDocs(playId ? query(base, where("playId", "==", playId)) : query(base));
  return snap.docs
    .map((d) => comId<Rehearsal>(d))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
}


export async function criarEnsaio(dados: Omit<Rehearsal, "id">): Promise<string> {
  const ref = doc(collection(db, "rehearsals"));
  await setDoc(ref, dados);
  return ref.id;
}

export async function atualizarEnsaio(id: string, dados: Partial<Rehearsal>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  await updateDoc(doc(db, "rehearsals", id), limpo);
}

export async function removerEnsaio(id: string): Promise<void> {
  await deleteDoc(doc(db, "rehearsals", id));
}

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

/* ---------------------------------------------------------------- presenças */

/** Respostas de presença de um ensaio, na ordem dos nomes. */
export async function listarPresencas(rehearsalId: string): Promise<Presenca[]> {
  const snap = await getDocs(collection(db, "rehearsals", rehearsalId, "presencas"));
  return snap.docs
    .map((d) => ({ ...(d.data() as Presenca), personId: d.id }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarPresenca(
  rehearsalId: string,
  personId: string,
): Promise<Presenca | null> {
  const snap = await getDoc(doc(db, "rehearsals", rehearsalId, "presencas", personId));
  return snap.exists() ? ({ ...(snap.data() as Presenca), personId: snap.id }) : null;
}

/**
 * Registra a resposta de presença. O id do documento é o da pessoa, o que faz
 * a resposta ser idempotente: responder de novo substitui a anterior.
 */
export async function salvarPresenca(
  rehearsalId: string,
  personId: string,
  nome: string,
  estado: PresencaEstado,
  justificativa = "",
): Promise<void> {
  await setDoc(doc(db, "rehearsals", rehearsalId, "presencas", personId), {
    nome,
    estado,
    justificativa: justificativa.trim(),
    atualizadoEm: new Date().toISOString(),
  });
}

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
