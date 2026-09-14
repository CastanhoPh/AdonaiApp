"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, firebaseConfigurado } from "./firebase";
import { buscarConta, buscarPessoa, comContato, salvarConta } from "./db";
import { definirContaDoCache, limparCacheDeTelas, limparDiscoAlheio } from "./hooks";
import type { Person, UserAccount } from "./types";

export { mensagemDeErro } from "./erros";

interface AuthState {
  carregando: boolean;
  usuario: User | null;
  /**
   * Quem está usando o app, mesmo antes de o Firebase confirmar a sessão.
   *
   * Use este em vez de `usuario` para decidir "há alguém logado?" e para
   * identificar a pessoa na interface. `usuario` continua sendo o objeto real
   * do Firebase e só existe depois da confirmação — quem precisa escrever
   * espera por ele de qualquer jeito, porque o SDK também espera.
   */
  uid: string | null;
  conta: UserAccount | null;
  pessoa: Person | null;
  ehAdmin: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/*
 * O vínculo entre conta e pessoa é feito pela direção, à mão.
 *
 * Antes acontecia sozinho: conta nova era ligada à pessoa cadastrada com o
 * mesmo e-mail. Automático é conveniente, mas decide sozinho quem é quem a
 * partir de um campo que qualquer pessoa escolhe ao se cadastrar — e o
 * histórico de uma pessoa é o tipo de coisa que não deve ser atribuída por
 * coincidência de texto.
 *
 * Conta sem vínculo entra no app e vê a tela de "sem vínculo" até a direção
 * ligá-la, em Pessoas › Acessos sem vínculo.
 */

/**
 * Garante que o token carregue `role` e `personId` como claims.
 *
 * As regras do Storage leem essas duas do token para decidir quem troca qual
 * foto. Quem as grava é a função `sincronizarClaims`, mas o token que o
 * navegador já tem em mãos não muda sozinho: sem forçar a renovação, a claim
 * nova só apareceria na próxima hora, e até lá o envio de foto seria negado.
 *
 * A comparação evita renovar a cada abertura — só quando o token está de fato
 * atrasado em relação à conta.
 */
async function alinharToken(user: User, conta: UserAccount): Promise<void> {
  try {
    const claims = (await user.getIdTokenResult()).claims;
    const desatualizado =
      claims.role !== conta.role || (claims.personId ?? null) !== (conta.personId ?? null);
    if (desatualizado) await user.getIdToken(true);
  } catch (erro) {
    // Sem token renovado o app funciona; só o envio de foto pode recusar.
    console.error("Falha ao renovar o token:", erro);
  }
}

/**
 * A última sessão vista neste aparelho, para abrir sem esperar a rede.
 *
 * Guarda só o que a interface precisa para se desenhar: quem é, o papel e a
 * ficha. Nada disso dá acesso a coisa nenhuma — as regras do Firestore só
 * respondem ao token, que não está aqui.
 */
interface SessaoLembrada {
  uid: string;
  conta: UserAccount;
  pessoa: Person | null;
  em: number;
}

const LEMBRANCA = "adonai:sessao";
/** Depois disto o palpite não vale mais: melhor o esqueleto que um retrato antigo. */
const VALIDADE_DA_LEMBRANCA = 30 * 24 * 60 * 60 * 1000;

function lerSessaoLembrada(): SessaoLembrada | null {
  if (typeof window === "undefined" || !firebaseConfigurado) return null;
  try {
    const cru = window.localStorage.getItem(LEMBRANCA);
    if (!cru) return null;
    const s = JSON.parse(cru) as SessaoLembrada;
    if (!s?.uid || !s.conta || !s.em || Date.now() - s.em > VALIDADE_DA_LEMBRANCA) return null;
    return s;
  } catch {
    return null;
  }
}

/*
 * A leitura do disco precisa ser estável e compatível com a hidratação.
 *
 * `useSyncExternalStore` existe justamente para valor que só o cliente tem: o
 * React usa o retrato do servidor (nulo) enquanto hidrata e troca para o do
 * cliente logo depois, sem acusar divergência. Ler direto no corpo do
 * componente rendia o erro #418 — o HTML pré-renderizado dizia "carregando" e
 * o cliente já dizia "entrou".
 *
 * O valor é calculado uma vez e guardado: `getSnapshot` que devolve objeto
 * novo a cada chamada põe o React em laço infinito.
 */
let retrato: SessaoLembrada | null | undefined;

function instantaneoDaSessao(): SessaoLembrada | null {
  if (retrato === undefined) {
    retrato = lerSessaoLembrada();
    // O cache de telas em disco só entrega dados da conta atual; sem registrar
    // o dono aqui, a primeira renderização não enxergaria nada.
    if (retrato) definirContaDoCache(retrato.uid);
  }
  return retrato;
}

/** No servidor não há sessão nenhuma: é o que o HTML pré-renderizado mostra. */
function semSessaoNoServidor(): SessaoLembrada | null {
  return null;
}

/** A lembrança não muda sozinha durante a vida da página. */
function assinarSessao(): () => void {
  return () => {};
}

function lembrarSessao(s: Omit<SessaoLembrada, "em">): void {
  retrato = { ...s, em: Date.now() };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEMBRANCA, JSON.stringify(retrato));
  } catch {
    // Cota ou janela anônima: o app só perde o atalho de abertura.
  }
}

function esquecerSessao(): void {
  retrato = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEMBRANCA);
  } catch {
    // Sem acesso ao armazenamento: não há o que esquecer.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * Abre com a última sessão conhecida em vez de esperar o Firebase.
   *
   * Ao carregar a página, o SDK valida a sessão guardada com uma ida ao
   * servidor (`accounts:lookup`) e só então avisa quem está logado. Medido num
   * celular a 4G, essa ida começava aos 450ms e terminava aos 750ms — e o app
   * inteiro ficava num esqueleto até lá, embora já soubesse de quem era a
   * sessão e já tivesse os dados da tela em disco.
   *
   * Agora a última sessão vale como resposta provisória: a tela aparece na
   * hora e a confirmação chega por trás. Se o Firebase disser que não há
   * sessão, o efeito abaixo limpa tudo e manda para o login, como sempre fez.
   *
   * Isto não afrouxa nada: quem decide o que pode ser lido são as regras do
   * Firestore, no servidor, e elas só respondem ao token de verdade. O que
   * aparece nesse intervalo é o que já estava guardado neste mesmo aparelho.
   */
  const lembrada = useSyncExternalStore(assinarSessao, instantaneoDaSessao, semSessaoNoServidor);

  const [carregandoAuth, setCarregandoAuth] = useState(firebaseConfigurado);
  /*
   * Trava de uma via: assim que o Firebase responde uma vez, a lembrança para
   * de valer para sempre nesta página. Sem isso, alguém sair e outra pessoa
   * entrar faria o palpite antigo reaparecer durante o carregamento do novo
   * perfil — e a segunda pessoa veria por um instante a tela da primeira.
   */
  const [jaConfirmou, setJaConfirmou] = useState(false);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [contaReal, setContaReal] = useState<UserAccount | null>(null);
  const [pessoaReal, setPessoaReal] = useState<Person | null>(null);

  const palpite = jaConfirmou ? null : lembrada;
  const conta = contaReal ?? palpite?.conta ?? null;
  const pessoa = pessoaReal ?? palpite?.pessoa ?? null;
  const carregando = carregandoAuth && !palpite;
  // Última conta vista, para esvaziar o cache de telas quando ela muda.
  /*
   * `undefined` = ainda não observamos nenhuma sessão nesta carga da página.
   * Antes era `null`, e aí abrir o app com sessão salva parecia troca de conta:
   * inofensivo enquanto o cache era só de memória (que nasce vazia), mas passou
   * a apagar o cache em disco logo na abertura — justamente o que ele existe
   * para evitar.
   */
  const ultimoUid = useRef<string | null | undefined>(undefined);

  const carregarPerfil = useCallback(async (user: User) => {
    let registro = await buscarConta(user.uid);

    // Conta de autenticação sem documento em `users` (criada pelo console, por
    // exemplo): cria como participante.
    if (!registro) {
      registro = {
        uid: user.uid,
        nome: user.displayName ?? (user.email ?? "").split("@")[0],
        email: (user.email ?? "").toLowerCase(),
        role: "participante",
        personId: null,
        criadoEm: new Date().toISOString(),
      };
      await salvarConta(registro);
    }

    await alinharToken(user, registro);
    /*
     * A ficha da própria pessoa vem com o contato junto.
     *
     * Telefone, nascimento e responsável saíram de `people` — que todo o elenco
     * lê — e foram para `privado/contato`. É uma leitura a mais, e só aqui:
     * são os dados dela, usados no Perfil e no cadastro de primeiro acesso.
     */
    const daFicha = registro.personId ? await buscarPessoa(registro.personId) : null;
    const doCadastro = daFicha ? await comContato(daFicha) : null;
    setContaReal(registro);
    setPessoaReal(doCadastro);
    lembrarSessao({ uid: user.uid, conta: registro, pessoa: doCadastro });
  }, []);

  useEffect(() => {
    if (!firebaseConfigurado) return;
    return onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid ?? null;
      const primeira = ultimoUid.current === undefined;
      const trocou = ultimoUid.current !== uid;
      if (trocou) {
        /*
         * Só troca de verdade apaga o que ficou guardado. Abrir o app com a
         * sessão de sempre não é troca: ali o cache em disco é justamente o que
         * faz a tela aparecer na hora.
         *
         * A ordem importa: limpa com o dono antigo ainda registrado, senão as
         * chaves da conta que saiu ficariam para trás.
         */
        if (!primeira) limparCacheDeTelas();
        definirContaDoCache(uid);
        // Na primeira vez, varre o que sobrou de outras contas e o que venceu.
        if (primeira) limparDiscoAlheio();
        ultimoUid.current = uid;
      }
      setUsuario(user);
      setJaConfirmou(true);
      if (!user) {
        // O Firebase disse que não há sessão: o palpite era velho, cai fora.
        esquecerSessao();
        setContaReal(null);
        setPessoaReal(null);
        setCarregandoAuth(false);
        return;
      }
      /*
       * Entrou uma conta nova e `conta` ainda é do estado anterior (nula, no
       * login). Sem voltar a carregar aqui, quem observa a sessão enxerga por
       * um instante um usuário autenticado já com `carregando` falso e
       * `ehAdmin` falso — e a tela de login manda a direção para /inicio, onde
       * o formulário de cadastro cobre tudo. Renovação de token mantém o mesmo
       * uid e não mexe no estado, para não piscar o esqueleto.
       */
      if (trocou) setCarregandoAuth(true);
      try {
        await carregarPerfil(user);
      } catch (erro) {
        console.error("Falha ao carregar o perfil:", erro);
        setContaReal(null);
        setPessoaReal(null);
      } finally {
        setCarregandoAuth(false);
      }
    });
  }, [carregarPerfil]);

  const entrar = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  }, []);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string) => {
    const credencial = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    await updateProfile(credencial.user, { displayName: nome.trim() });
    await salvarConta({
      uid: credencial.user.uid,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      role: "participante",
      // Sem vínculo: quem liga a conta à pessoa é a direção.
      personId: null,
      criadoEm: new Date().toISOString(),
    });
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const sair = useCallback(async () => {
    // Esquece antes de sair: se a página fechar no meio, não sobra palpite.
    esquecerSessao();
    await signOut(auth);
  }, []);

  const recarregar = useCallback(async () => {
    if (auth.currentUser) await carregarPerfil(auth.currentUser);
  }, [carregarPerfil]);

  const valor = useMemo<AuthState>(
    () => ({
      carregando,
      usuario,
      uid: usuario?.uid ?? palpite?.uid ?? null,
      conta,
      pessoa,
      ehAdmin: conta?.role === "admin",
      entrar,
      cadastrar,
      recuperarSenha,
      sair,
      recarregar,
    }),
    [carregando, usuario, palpite, conta, pessoa, entrar, cadastrar, recuperarSenha, sair, recarregar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return contexto;
}
