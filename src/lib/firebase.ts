import { initializeApp, getApp, getApps, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const chave = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projeto = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** Falso quando o `.env.local` ainda não foi preenchido — a UI avisa em vez de quebrar. */
export const firebaseConfigurado = Boolean(chave && projeto);

/*
 * Sem as chaves reais o SDK recebe valores de reserva: `getAuth` recusa uma
 * apiKey vazia e derrubaria até a compilação. Nenhuma chamada de rede é feita
 * nesse estado porque a interface para em `firebaseConfigurado`.
 */
const config: FirebaseOptions = firebaseConfigurado
  ? {
      apiKey: chave,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: projeto,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
  : {
      apiKey: "firebase-nao-configurado",
      projectId: "firebase-nao-configurado",
    };

const app = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(app);

/*
 * Cache em disco (IndexedDB).
 *
 * Sem ele o Firestore guarda tudo só em memória: cada abertura do app, cada F5
 * e cada instalação na tela de início recomeçavam do zero, e toda tela pagava
 * a ida e volta até o servidor antes de mostrar qualquer coisa. Com o cache
 * persistente as mesmas consultas voltam do disco em poucos milissegundos, e a
 * releitura no servidor manda só o que mudou desde a última vez.
 *
 * `initializeFirestore` só vale antes do primeiro `getFirestore`, por isso vem
 * aqui e não numa chamada solta. Na pré-renderização do build não há
 * IndexedDB, então lá fica o padrão em memória — o que é o correto: aquele
 * processo não tem usuário nem sessão.
 */
function abrirFirestore() {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Já inicializado nesta página (recarga a quente do `next dev`): reusa.
    return getFirestore(app);
  }
}

export const db = abrirFirestore();
export const storage = getStorage(app);
export default app;
