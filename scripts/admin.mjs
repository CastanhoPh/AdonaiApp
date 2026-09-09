/**
 * Cria (ou promove) uma conta de administrador da direção.
 *
 *   npm run admin -- direcao@exemplo.com "Nome Completo"
 *
 * A senha pode ser informada por ADONAI_SENHA; sem ela, o script imprime um
 * link de uso único para a pessoa definir a própria senha.
 */
import { provisionarConta } from "./provisionar-conta.mjs";

await provisionarConta({ role: "admin" });
