/** Modelo de dados do AdonaiApp (Firestore). */

export type Role = "admin" | "participante";

/** Conta de acesso. Documento em `users/{uid}`. */
export interface UserAccount {
  uid: string;
  nome: string;
  email: string;
  role: Role;
  /** Aponta para `people/{personId}`. Nulo enquanto a direção não cadastrar a pessoa. */
  personId: string | null;
  /** Tokens de push, um por aparelho em que a pessoa autorizou os avisos. */
  tokensFcm?: string[];
  criadoEm: string;
}

export const AVISO_ALVOS = ["convocados", "elenco", "todos"] as const;
export type AvisoAlvo = (typeof AVISO_ALVOS)[number];

export const AVISO_ALVO_LABEL: Record<AvisoAlvo, string> = {
  convocados: "Convocados de um ensaio",
  elenco: "Elenco da peça atual",
  todos: "Todos os integrantes ativos",
};

/**
 * Aviso disparado pela direção. Documento em `avisos/{avisoId}`.
 *
 * A direção grava o aviso como pendente e quem entrega é o disparador
 * (`scripts/enviar-avisos.mjs`): mandar push exige credencial de servidor, que
 * não pode ficar no navegador.
 */
export interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  alvo: AvisoAlvo;
  /** Preenchido quando o alvo é `convocados`. */
  rehearsalId: string;
  /** Peça de referência para os alvos `convocados` e `elenco`. */
  playId: string;
  criadoPor: string;
  criadoEm: string;
  status: "pendente" | "enviado" | "erro";
  enviadoEm: string;
  /** Resumo do envio ou a mensagem de erro. */
  detalhe: string;
  /** Quantos aparelhos receberam. */
  entregues: number;
  /** Criado pelo lembrete diário, não por alguém da direção. */
  automatico?: boolean;
}

/*
 * Faixas de peças já feitas. "1" e "2 a 3" ficam separadas de propósito: a
 * lista original tinha "1" e "1 a 3", e quem fez exatamente uma peça teria
 * duas respostas certas — dado que sai inconsistente na hora de comparar.
 */
export const PECAS_FAIXAS = ["1", "2 a 3", "4 a 6", "7 a 9", "10+"] as const;
export type PecasFaixa = (typeof PECAS_FAIXAS)[number];

export const EXPERIENCIAS = [
  "menos de 1 ano",
  "1 a 2 anos",
  "3 a 5 anos",
  "mais de 5 anos",
] as const;
export type Experiencia = (typeof EXPERIENCIAS)[number];

/** Idade a partir da qual não se pede responsável. */
export const MAIORIDADE = 18;

/** Integrante do teatro. Documento em `people/{personId}`. */
export interface Person {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  fotoUrl: string;
  ativo: boolean;
  /**
   * Ids de `traits/{traitId}` marcadas para a pessoa.
   *
   * Não fica no documento: é avaliação da direção e mora em
   * `direcao/caracteristicas`, que só administrador lê. Chega aqui mesclado
   * por `comCaracteristicas`, e por isso é opcional — no cliente do
   * participante vem sempre vazio.
   */
  caracteristicas?: string[];
  criadoEm: string;

  /*
   * Respostas do cadastro de primeiro acesso. Opcionais porque os cadastros
   * criados pela direção antes do formulário não têm esses campos.
   */

  /**
   * Data de nascimento, `AAAA-MM-DD`. Guardamos a data e não a idade: idade
   * envelhece sozinha, e é dela que depende a exigência de responsável.
   */
  nascimento?: string;
  responsavelNome?: string;
  responsavelTelefone?: string;
  /** Nulo enquanto a pessoa não responde. */
  jaAtuou?: boolean | null;
  experiencia?: Experiencia | "";
  /** Faixa de peças feitas antes do AdonaiApp, informada pela própria pessoa. */
  pecasAnteriores?: PecasFaixa | "";
  /** Preenchido quando o formulário é concluído; vazio significa pendente. */
  cadastroCompletoEm?: string;
}

/**
 * Observações internas da direção sobre uma pessoa.
 * Fica em `people/{personId}/privado/direcao` para que as regras do Firestore
 * possam liberar a leitura apenas para administradores (regra 7 do briefing).
 */
export interface PersonNotes {
  observacoes: string;
  atualizadoEm: string;
}

/** Característica de atuação selecionável. Documento em `traits/{traitId}`. */
export interface Trait {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export const PLAY_STATUS = [
  "planejamento",
  "escalacao",
  "ensaio",
  "pronta",
  "concluida",
  "arquivada",
] as const;
export type PlayStatus = (typeof PLAY_STATUS)[number];

export const PLAY_STATUS_LABEL: Record<PlayStatus, string> = {
  planejamento: "Em planejamento",
  escalacao: "Em escalação",
  ensaio: "Em ensaio",
  pronta: "Pronta para apresentação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

/** Peça teatral. Documento em `plays/{playId}`. */
export interface Play {
  id: string;
  titulo: string;
  descricao: string;
  capaUrl: string;
  /**
   * Evento em que a peça foi apresentada, quando houve um: "Natal 2024",
   * "Congresso de Jovens". Opcional porque muita peça é avulsa, e é o que dá
   * contexto no histórico anos depois — "Rede Mil" diz menos que
   * "Rede Mil · Congresso de Jovens 2023".
   */
  nomeEvento?: string;
  /** Data prevista da apresentação, no formato `YYYY-MM-DD`. */
  dataApresentacao: string;
  /** Onde a peça será apresentada. Ex.: "Templo sede". */
  local: string;
  status: PlayStatus;
  /** Apenas uma peça pode ser a atual (regra 7 do briefing). */
  atual: boolean;
  roteiroVersao: number;
  roteiroPublicado: boolean;
  /** Data da última publicação, mostrada no cabeçalho do roteiro. */
  roteiroPublicadoEm: string;
  /** Última alteração no rascunho, mostrada no editor. */
  roteiroEditadoEm: string;
  /** Tamanho do roteiro na última publicação, para evitar varrer as falas. */
  totalFalas?: number;
  totalCenas?: number;
  criadoEm: string;
}

export const ROLE_TYPES = [
  "protagonista",
  "coadjuvante",
  "antagonista",
  "narrador",
  "especial",
  "figurante",
] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  protagonista: "Protagonista",
  coadjuvante: "Coadjuvante",
  antagonista: "Antagonista",
  narrador: "Narrador",
  especial: "Participação especial",
  figurante: "Figurante",
};

/** Personagem de uma peça. Documento em `plays/{playId}/characters/{characterId}`. */
export interface Character {
  id: string;
  playId: string;
  nome: string;
  descricao: string;
  tipoPapel: RoleType;
  /** Desejadas para o papel. Fora do documento, como em `Person`. */
  caracteristicasDesejadas?: string[];
  /** Pessoa escalada. Um personagem tem no máximo uma pessoa por vez (regra 7). */
  personId: string | null;
  personNome: string;
  situacao: "pendente" | "confirmado";
  observacoes: string;
  imagemUrl: string;
  ordem: number;
}

export const LINE_KINDS = ["fala", "narracao", "acao"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const LINE_KIND_LABEL: Record<LineKind, string> = {
  fala: "Fala",
  narracao: "Narração",
  acao: "Ação de cena",
};

/** Linha do roteiro. Documento em `plays/{playId}/lines/{lineId}`. */
export interface ScriptLine {
  id: string;
  playId: string;
  ato: number;
  /** Nome do ato, repetido nas linhas dele. Ex.: "A espera". */
  atoTitulo: string;
  cena: number;
  /** Nome da cena, repetido nas linhas dela. Ex.: "O retorno". */
  cenaTitulo: string;
  ordem: number;
  tipo: LineKind;
  /** Obrigatório quando `tipo` é `fala`: permite destacar as falas do usuário. */
  characterId: string | null;
  characterNome: string;
  texto: string;
}

export const REHEARSAL_STATUS = [
  "agendado",
  "confirmado",
  "alterado",
  "cancelado",
  "concluido",
] as const;
export type RehearsalStatus = (typeof REHEARSAL_STATUS)[number];

export const REHEARSAL_STATUS_LABEL: Record<RehearsalStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  alterado: "Alterado",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

/** Ensaio. Documento em `rehearsals/{rehearsalId}`. */
export interface Rehearsal {
  id: string;
  playId: string;
  playTitulo: string;
  /** `YYYY-MM-DD`. */
  data: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  /** Quando verdadeiro, todo o elenco está convocado. */
  todos: boolean;
  /** Ids de pessoas convocadas, usado quando `todos` é falso. */
  convocados: string[];
  observacoes: string;
  status: RehearsalStatus;
}

export const PRESENCA_ESTADOS = ["confirmado", "ausente"] as const;
export type PresencaEstado = (typeof PRESENCA_ESTADOS)[number];

/**
 * Resposta de presença de uma pessoa a um ensaio.
 * Documento em `rehearsals/{rehearsalId}/presencas/{personId}` — o id é o da
 * pessoa, então cada uma escreve só no próprio documento e ninguém sobrescreve
 * a resposta de outro.
 */
export interface Presenca {
  personId: string;
  /** Nome guardado junto para a direção listar sem precisar cruzar coleções. */
  nome: string;
  estado: PresencaEstado;
  justificativa: string;
  atualizadoEm: string;
}

/**
 * Participação histórica de uma pessoa em uma peça.
 * Criada somente quando a peça é concluída (regra 7 do briefing).
 * Documento em `participations/{participationId}`.
 */
export interface Participation {
  id: string;
  personId: string;
  playId: string;
  playTitulo: string;
  playCapaUrl: string;
  characterId: string;
  characterNome: string;
  tipoPapel: RoleType;
  /** Evento da peça, copiado no registro para o histórico não depender dela. */
  playEvento?: string;
  /** Período/data da apresentação, no formato `YYYY-MM-DD`. */
  periodo: string;
  concluidaEm: string;
}
