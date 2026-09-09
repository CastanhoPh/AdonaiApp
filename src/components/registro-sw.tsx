"use client";

import { useEffect } from "react";
import { registrarServiceWorker } from "@/lib/instalacao";

/**
 * Registra o service worker na carga do app. Precisa acontecer cedo: sem ele
 * ativo o navegador não dispara `beforeinstallprompt` e o botão de instalar
 * nunca aparece.
 */
export function RegistroServiceWorker() {
  useEffect(() => {
    registrarServiceWorker();
  }, []);
  return null;
}
