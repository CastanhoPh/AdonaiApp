"use client";

/**
 * O editor de roteiro virou aba da peça.
 *
 * Esta rota fica como encaminhamento: quem tiver o endereço antigo salvo, ou um
 * link antigo em conversa, continua chegando no lugar certo. A implementação
 * mora em `components/admin/aba-roteiro`, e é a mesma que a aba usa — duas
 * cópias divergiriam na primeira correção feita em só uma delas.
 */
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CorpoAdmin } from "@/components/shell";
import { Carregando } from "@/components/ui";

export default function RoteiroAntigo() {
  // useSearchParams exige um limite de Suspense na renderização estática.
  return (
    <Suspense
      fallback={
        <CorpoAdmin>
          <Carregando texto="Abrindo o editor de roteiro" />
        </CorpoAdmin>
      }
    >
      <Encaminhar />
    </Suspense>
  );
}

function Encaminhar() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  useEffect(() => {
    router.replace(id ? `/admin/pecas/detalhe?id=${id}&aba=roteiro` : "/admin/pecas");
  }, [id, router]);

  return (
    <CorpoAdmin>
      <Carregando texto="Abrindo o editor de roteiro" />
    </CorpoAdmin>
  );
}
