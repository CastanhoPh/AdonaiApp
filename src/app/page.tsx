"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firebaseConfigurado } from "@/lib/firebase";
import { Carregando, Vazio } from "@/components/ui";

/** Porta de entrada: encaminha para a área do participante ou da direção. */
export default function Raiz() {
  const { carregando, usuario, ehAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!firebaseConfigurado || carregando) return;
    router.replace(!usuario ? "/login" : ehAdmin ? "/admin" : "/inicio");
  }, [carregando, usuario, ehAdmin, router]);

  if (!firebaseConfigurado) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Vazio
          titulo="Firebase não configurado"
          descricao="Copie .env.local.example para .env.local e preencha as chaves do projeto Firebase. O README explica cada passo."
        />
      </main>
    );
  }

  return <Carregando texto="Abrindo o AdonaiApp…" />;
}
