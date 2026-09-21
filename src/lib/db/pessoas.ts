import {
  collection,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getDocs, getDoc, contar, comId } from "./firestore";
import { definirCaracteristicasDaPessoa } from "./caracteristicas";
import { salvarContato } from "./contato";
import type {
  ContatoPessoal,
  Person,
  PersonNotes,
} from "../types";

/* ----------------------------------------------------------------- pessoas */

export async function listarPessoas(): Promise<Person[]> {
  const snap = await getDocs(query(collection(db, "people"), orderBy("nome")));
  return snap.docs.map((d) => comId<Person>(d));
}

/**
 * Quantas pessoas há, ativas e inativas, sem trazer a lista.
 *
 * Inativas sai por subtração porque `ativo` falta em ficha antiga, e consulta
 * por `ativo == false` deixaria essas de fora — o que a tela quer dizer é
 * "todas as que não estão ativas".
 */
export async function contarPessoas(): Promise<{ ativas: number; inativas: number }> {
  const pessoas = collection(db, "people");
  const [total, ativas] = await Promise.all([
    contar(query(pessoas)),
    contar(query(pessoas, where("ativo", "==", true))),
  ]);
  return { ativas, inativas: total - ativas };
}

export async function buscarPessoa(id: string): Promise<Person | null> {
  const snap = await getDoc(doc(db, "people", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Person) : null;
}

export async function criarPessoa(dados: Omit<Person, "id" | "criadoEm">): Promise<string> {
  // Três coisas não moram no documento da pessoa: as características, que são
  // avaliação da direção, o contato e o e-mail, que o elenco não precisa ler.
  const { caracteristicas, contato, email, ...doDocumento } = dados;
  const ref = doc(collection(db, "people"));
  await setDoc(ref, { ...doDocumento, criadoEm: new Date().toISOString() });
  if (caracteristicas?.length) await definirCaracteristicasDaPessoa(ref.id, caracteristicas);
  const privado = { ...contato, ...(email ? { email: email.toLowerCase() } : {}) };
  if (Object.keys(privado).length > 0) await salvarContato(ref.id, privado);
  return ref.id;
}

export async function atualizarPessoa(id: string, dados: Partial<Person>): Promise<void> {
  const limpo = { ...dados };
  delete limpo.id;
  // Desviada para o documento da direção, nunca para o da pessoa.
  const caracteristicas = limpo.caracteristicas;
  delete limpo.caracteristicas;
  /*
   * Desviados para `privado/contato`, que só a direção e a própria pessoa
   * leem. O e-mail vem solto em `dados` por comodidade de quem chama — a tela
   * tem um campo "E-mail", não um campo "contato.email" —, e é aqui que ele
   * encontra o resto do contato.
   */
  const contato = { ...limpo.contato };
  delete limpo.contato;
  if (typeof limpo.email === "string") contato.email = limpo.email.toLowerCase();
  delete limpo.email;
  if (Object.keys(contato).length > 0) await salvarContato(id, contato);
  if (Object.keys(limpo).length > 0) await updateDoc(doc(db, "people", id), limpo);
  if (caracteristicas) await definirCaracteristicasDaPessoa(id, caracteristicas);
}

/**
 * Campos que a própria pessoa preenche no cadastro de primeiro acesso.
 *
 * Vão para dois lugares: o que a lista de elenco mostra fica em `people`, e o
 * contato pessoal vai para `privado/contato`. Quem chama não precisa saber
 * disso — `completarCadastro` separa.
 */
export type CadastroDaPessoa = Pick<
  Person,
  "nome" | "jaAtuou" | "experiencia" | "pecasAnteriores"
> &
  ContatoPessoal;

/**
 * Grava as respostas do cadastro e marca a conclusão. `cadastroCompletoEm`
 * vazio é o que faz o formulário reaparecer no próximo acesso, então ele é
 * escrito junto com os dados, nunca antes.
 */
export async function completarCadastro(
  personId: string,
  dados: CadastroDaPessoa,
): Promise<void> {
  /*
   * `email` sai daqui junto com o resto do contato.
   *
   * O que não for destrinchado aqui cai em `naFicha` e vai para o documento
   * que todo o elenco lê — então esta linha é o que separa os dois destinos, e
   * esquecer um campo nela é recolocá-lo em público sem ninguém notar.
   */
  const { email, telefone, nascimento, responsavelNome, responsavelTelefone, ...naFicha } = dados;
  await salvarContato(personId, {
    email,
    telefone,
    nascimento,
    responsavelNome,
    responsavelTelefone,
  });
  await updateDoc(doc(db, "people", personId), {
    ...naFicha,
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

/**
 * Troca o nome da pessoa e leva a mudança para onde ele está copiado.
 *
 * `characters.personNome` guarda o nome do ator para a tela de elenco não
 * depender de ler a ficha de cada um, e `users.nome` guarda o nome da conta,
 * usado como reserva na interface. Atualizar só `people` deixava as duas
 * cópias com o nome antigo — e é justamente na lista de elenco e no cabeçalho
 * que a pessoa olha para se reconhecer.
 *
 * Percorre as peças em vez de usar consulta por grupo de coleção: são dezenas
 * de peças, a consulta por grupo pediria índice declarado, e o custo aqui é
 * pago uma vez por renomeação.
 */
export async function renomearPessoa(id: string, nome: string): Promise<void> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("O nome não pode ficar vazio.");

  const lote = writeBatch(db);
  lote.update(doc(db, "people", id), { nome: limpo });

  const pecas = await getDocs(collection(db, "plays"));
  for (const peca of pecas.docs) {
    const papeis = await getDocs(
      query(collection(db, "plays", peca.id, "characters"), where("personId", "==", id)),
    );
    papeis.docs.forEach((papel) => lote.update(papel.ref, { personNome: limpo }));
  }

  const contas = await getDocs(query(collection(db, "users"), where("personId", "==", id)));
  contas.docs.forEach((conta) => lote.update(conta.ref, { nome: limpo }));

  await lote.commit();
}
