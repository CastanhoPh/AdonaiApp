/**
 * Cria uma conta de participante já vinculada a um cadastro em Pessoas.
 *
 *   npm run participante -- pessoa@exemplo.com "Nome Completo"
 *
 * Atalho para quando a direção prefere criar o acesso em vez de pedir que a
 * pessoa se cadastre sozinha em /cadastro. A senha pode ser informada por
 * ADONAI_SENHA; sem ela, o script imprime um link para a pessoa definir a dela.
 */
import { provisionarConta } from "./provisionar-conta.mjs";

await provisionarConta({ role: "participante" });
