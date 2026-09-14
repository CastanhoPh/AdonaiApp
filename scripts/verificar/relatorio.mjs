/**
 * O vocabulário do relatório.
 *
 * Cada verificação devolve uma lista de achados, e cada achado diz **onde** e
 * **o quê** em linguagem de quem cuida do teatro, não de quem escreveu o
 * código: "Celine — a foto responde 404" serve; "fotoUrl HTTP 404" não.
 *
 * A gravidade decide o código de saída. `alta` é o que já está errado para
 * alguém do grupo agora; `média` é o que vai dar errado; `baixa` é sujeira.
 * Só `alta` reprova.
 */
export const GRAVIDADES = ["alta", "média", "baixa"];

export function criarCaderno() {
  const achados = [];
  return {
    achados,
    anotar: (gravidade, onde, oQue) => achados.push({ gravidade, onde, oQue }),
    /** Anota quando a condição falha; devolve se passou, para encadear. */
    conferir(condicao, gravidade, onde, oQue) {
      if (!condicao) achados.push({ gravidade, onde, oQue });
      return Boolean(condicao);
    },
  };
}

const COR = { alta: "[31m", "média": "[33m", baixa: "[90m" };
const NEUTRO = "[0m";
const colorido = process.stdout.isTTY && !process.env.NO_COLOR;
const tingir = (g, texto) => (colorido ? `${COR[g]}${texto}${NEUTRO}` : texto);

export function imprimirAchados(achados, recuo = "     ") {
  for (const gravidade of GRAVIDADES) {
    const dela = achados.filter((a) => a.gravidade === gravidade);
    if (dela.length === 0) continue;
    console.log(`${recuo}${tingir(gravidade, gravidade)} (${dela.length})`);
    const largura = Math.max(...dela.map((a) => String(a.onde).length));
    for (const a of dela) {
      console.log(`${recuo}  ${String(a.onde).padEnd(largura)}  ${a.oQue}`);
    }
  }
}

export function contarPorGravidade(achados) {
  return Object.fromEntries(
    GRAVIDADES.map((g) => [g, achados.filter((a) => a.gravidade === g).length]),
  );
}
