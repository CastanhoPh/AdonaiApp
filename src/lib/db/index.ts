/**
 * Acesso ao Firestore, por assunto.
 *
 * Era um arquivo de 1.309 linhas. Cresceu assim porque tudo que fala com o
 * banco tinha um lugar óbvio para ir, e nenhum momento óbvio para parar — e
 * duas mudanças previstas (apresentação como entidade e ficha de interpretação
 * do personagem) engordariam mais.
 *
 * A divisão é por assunto, não por camada: quem vai mexer em roteiro abre
 * `roteiro.ts`, não "os repositórios". As regras que envolvem mais de uma
 * coleção moram no módulo de quem manda — concluir peça é de `pecas`, mesmo
 * escrevendo em `participations`.
 *
 * Este arquivo reexporta tudo de propósito: as telas continuam importando de
 * `@/lib/db`, e a quebra não custou uma linha de mudança fora daqui.
 */
export * from "./contas";
export * from "./pessoas";
export * from "./exercicios";
export * from "./convites";
export * from "./contato";
export * from "./caracteristicas";
export * from "./pecas";
export * from "./personagens";
export * from "./roteiro";
export * from "./ensaios";
export * from "./avisos";
export * from "./presencas";
export * from "./participacoes";
