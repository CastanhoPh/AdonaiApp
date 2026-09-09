/** Formatações de data e texto em pt-BR. Datas trafegam como `YYYY-MM-DD`. */

const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Converte `YYYY-MM-DD` em Date local, sem o deslocamento de fuso do parse ISO. */
export function parseDate(iso: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!partes) return null;
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

export function hojeISO(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** `2026-03-15` → `15 de março de 2026`. */
export function dataLonga(iso: string): string {
  const data = parseDate(iso);
  if (!data) return "Data a definir";
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

/** `2026-03-15` → `15/03`. */
export function dataCurta(iso: string): string {
  const data = parseDate(iso);
  if (!data) return "--/--";
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
}



export function primeiroNome(nome: string): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Nome de exibição: primeiro + último nome. Nomes compostos longos ocupariam
 * espaço demais em cartões, tabelas e na tab bar, e o cadastro completo
 * continua guardado em `people.nome`.
 */
export function nomeCurto(nome: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

export function iniciais(nome: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Remove acentos e caixa, para busca por nome. */
export function normalizar(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pluralizar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/* ------------------------------------------------- formatos do design novo */

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Dia do mês sem zero à esquerda, para o bloco de data dos ensaios. */
export function diaDoMes(iso: string): string {
  return String(parseDate(iso)?.getDate() ?? "--");
}

/** `2026-09-13` → `set`. */
export function mesCurto(iso: string): string {
  const data = parseDate(iso);
  return data ? MESES_CURTOS[data.getMonth()] : "---";
}

/** `2026-09-13` → `13/09`. Usado no cabeçalho do roteiro e nas faixas. */

/** `Sábado` (primeira maiúscula). */
export function diaSemana(iso: string): string {
  const data = parseDate(iso);
  if (!data) return "";
  const dia = DIAS[data.getDay()].replace("-feira", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}`;
}

/** `19:30` → `19h30`; `19:00` → `19h00`. */
export function hora(valor: string): string {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(valor ?? "");
  return partes ? `${partes[1]}h${partes[2]}` : (valor ?? "");
}

/** `19:30` + `21:30` → `19h30 – 21h30`. */
export function faixaHoraria(inicio: string, fim: string): string {
  if (!inicio) return "Horário a definir";
  return fim ? `${hora(inicio)} – ${hora(fim)}` : hora(inicio);
}

/** `Sábado, 15h00 – 17h00`. */
export function diaSemanaEHorario(iso: string, inicio: string, fim: string): string {
  const dia = diaSemana(iso);
  const horario = faixaHoraria(inicio, fim);
  return dia ? `${dia}, ${horario}` : horario;
}

/** Ano de uma data ISO, para a coluna de ano do histórico. */
export function ano(iso: string): string {
  return (iso ?? "").slice(0, 4) || "----";
}

/** `hoje, 20h12` ou `12/09, 20h12` — para "última edição". */
export function editadoEm(isoCompleto: string): string {
  if (!isoCompleto) return "sem edições";
  const data = new Date(isoCompleto);
  if (Number.isNaN(data.getTime())) return "sem edições";
  const relogio = `${String(data.getHours()).padStart(2, "0")}h${String(data.getMinutes()).padStart(2, "0")}`;
  const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  return dia === hojeISO() ? `hoje, ${relogio}` : `${dataCurta(dia)}, ${relogio}`;
}

/** Nome do ato com o título, quando houver: `Ato II — A espera`. */
export function rotuloAto(numero: number, titulo?: string): string {
  return titulo ? `Ato ${numero} — ${titulo}` : `Ato ${numero}`;
}

/** Nome da cena com o título, quando houver: `Cena 3 · O retorno`. */
export function rotuloCena(numero: number, titulo?: string): string {
  return titulo ? `Cena ${numero} · ${titulo}` : `Cena ${numero}`;
}

/* ------------------------------------------------------- idade e maioridade */

/** Idade em anos completos a partir da data de nascimento. */
export function idade(nascimento: string): number | null {
  const data = parseDate(nascimento);
  if (!data) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - data.getFullYear();
  const fezAniversario =
    hoje.getMonth() > data.getMonth() ||
    (hoje.getMonth() === data.getMonth() && hoje.getDate() >= data.getDate());
  if (!fezAniversario) anos -= 1;
  return anos >= 0 && anos < 130 ? anos : null;
}

/** Verdadeiro quando a pessoa tem menos que a maioridade. */
export function ehMenorDeIdade(nascimento: string, maioridade = 18): boolean {
  const anos = idade(nascimento);
  return anos !== null && anos < maioridade;
}
