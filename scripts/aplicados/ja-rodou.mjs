/**
 * Trava dos scripts que já cumpriram o que tinham para fazer.
 *
 * Os scripts desta pasta rodaram uma vez, contra a produção, e o banco hoje
 * está do outro lado da mudança que eles fazem. Rodar de novo vai de inócuo a
 * destrutivo conforme o caso — `mover-email` procuraria um campo que não
 * existe mais e não faria nada, mas `corrigir-papeis` reescreveria escalação
 * que a direção ajustou à mão depois.
 *
 * Eles ficam no repositório porque contam o que foi feito no dado e por quê: o
 * banco é o resultado deles, e sem o código não dá para reconstruir o
 * raciocínio meses depois. O que não podem é ser fáceis de executar por
 * engano — daí a trava.
 *
 * Para rodar mesmo assim, de propósito:
 *
 *     ADONAI_RODAR_DE_NOVO=1 node scripts/aplicados/<nome>.mjs
 */
export function jaRodou(quando, oQueFez) {
  if (process.env.ADONAI_RODAR_DE_NOVO === "1") {
    console.warn(`\n  ⚠ Script aposentado, rodando por insistência explícita.\n`);
    return;
  }
  console.error(`
  Este script já foi aplicado${quando ? ` em ${quando}` : ""} e está aposentado.

  O que ele fez: ${oQueFez}

  O banco hoje já está do outro lado dessa mudança. Rodar de novo, na melhor
  hipótese, não faz nada; na pior, desfaz ajuste que a direção fez à mão.

  Se for mesmo o que você quer:
    ADONAI_RODAR_DE_NOVO=1 node ${process.argv[1]?.split(/[\\/]/).slice(-3).join("/") ?? "<script>"}

  Antes disso, uma cópia:  npm run backup
`);
  process.exit(2);
}
