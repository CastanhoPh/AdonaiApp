"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { buscarConta, buscarPessoa, buscarPessoaPorEmail, salvarConta } from "./db";
import { limparCacheDeTelas } from "./hooks";
import type { Person, UserAccount } from "./types";

export { mensagemDeErro } from "./erros";

interface AuthState {
  carregando: boolean;
  usuario: User | null;
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

/**
 * Vincula a conta à pessoa cadastrada pela direção com o mesmo e-mail.
 * A tentativa é repetida a cada carregamento enquanto `personId` for nulo,
 * para que o vínculo aconteça mesmo quando a pessoa é cadastrada depois.
 */
async function vincularPessoa(conta: UserAccount): Promise<UserAccount> {
  if (conta.personId) return conta;
  const pessoa = await buscarPessoaPorEmail(conta.email);
  if (!pessoa) return conta;
  const atualizada = { ...conta, personId: pessoa.id };
  await salvarConta(atualizada);
  return atualizada;
}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sem as chaves do Firebase não há o que carregar.
  const [carregando, setCarregando] = useState(firebaseConfigurado);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [conta, setConta] = useState<UserAccount | null>(null);
  const [pessoa, setPessoa] = useState<Person | null>(null);
  // Última conta vista, para esvaziar o cache de telas quando ela muda.
  const ultimoUid = useRef<string | null>(null);

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

    registro = await vincularPessoa(registro);
    await alinharToken(user, registro);
    setConta(registro);
    setPessoa(registro.personId ? await buscarPessoa(registro.personId) : null);
  }, []);

  useEffect(() => {
    if (!firebaseConfigurado) return;
    return onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid ?? null;
      const trocou = ultimoUid.current !== uid;
      if (trocou) {
        // Sair ou trocar de conta descarta o que foi carregado pela anterior.
        limparCacheDeTelas();
        ultimoUid.current = uid;
      }
      setUsuario(user);
      if (!user) {
        setConta(null);
        setPessoa(null);
        setCarregando(false);
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
      if (trocou) setCarregando(true);
      try {
        await carregarPerfil(user);
      } catch (erro) {
        console.error("Falha ao carregar o perfil:", erro);
        setConta(null);
        setPessoa(null);
      } finally {
        setCarregando(false);
      }
    });
  }, [carregarPerfil]);

  const entrar = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  }, []);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string) => {
    const credencial = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    await updateProfile(credencial.user, { displayName: nome.trim() });
    const pessoaVinculada = await buscarPessoaPorEmail(email);
    await salvarConta({
      uid: credencial.user.uid,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      role: "participante",
      personId: pessoaVinculada?.id ?? null,
      criadoEm: new Date().toISOString(),
    });
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const sair = useCallback(async () => {
    await signOut(auth);
  }, []);

  const recarregar = useCallback(async () => {
    if (auth.currentUser) await carregarPerfil(auth.currentUser);
  }, [carregarPerfil]);

  const valor = useMemo<AuthState>(
    () => ({
      carregando,
      usuario,
      conta,
      pessoa,
      ehAdmin: conta?.role === "admin",
      entrar,
      cadastrar,
      recuperarSenha,
      sair,
      recarregar,
    }),
    [carregando, usuario, conta, pessoa, entrar, cadastrar, recuperarSenha, sair, recarregar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return contexto;
}
