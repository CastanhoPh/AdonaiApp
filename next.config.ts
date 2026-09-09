import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * O AdonaiApp é renderizado inteiramente no navegador (todo o acesso a dados
   * passa pelo SDK do Firebase), então a exportação estática gera o site
   * completo em `out/` e ele roda no Firebase Hosting sem servidor — dentro do
   * plano gratuito. É por isso que as telas de detalhe recebem o id por query
   * string (?id=) em vez de rota dinâmica: rota dinâmica exigiria conhecer
   * todos os ids no momento do build.
   */
  output: "export",

  // Fixa a raiz do projeto: sem isso o Turbopack pode subir até a pasta do
  // usuário procurando um lockfile.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
