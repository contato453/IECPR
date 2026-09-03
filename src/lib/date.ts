/**
 * Utilidades de data/hora do sistema IECPR.
 *
 * REGRA CRÍTICA (ver Bug #1 da documentação de reconstrução):
 * `new Date("YYYY-MM-DD")` é interpretado como UTC meia-noite. Em
 * America/Sao_Paulo (UTC-3) isso "volta" para o dia anterior às 21h, fazendo
 * um evento de domingo aparecer como sábado. Por isso, TODA conversão de uma
 * data pura (sem hora) para `Date` passa por meio-dia local antes de
 * formatar — imune a fuso e a horário de verão.
 *
 * Toda formatação de exibição usa `Intl.DateTimeFormat("pt-BR", { timeZone:
 * TIME_ZONE })`. Nunca usar `.toLocaleString()` sem timeZone explícito.
 */

export const TIME_ZONE = "America/Sao_Paulo";

/** Converte "YYYY-MM-DD" em Date ao meio-dia local — nunca em UTC meia-noite. */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

/** Formata um Date, um timestamp ISO ou uma data pura "YYYY-MM-DD" para "DD/MM/AAAA". */
export function formatDateBR(value: string | Date): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Formata a hora local "HH:MM", sempre 24h (hour12: false). */
export function formatTimeBR(value: string | Date): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Formata "Dia 12, domingo" a partir de uma data pura ou timestamp. */
export function formatDayHeader(value: string | Date): string {
  const date = toDate(value);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long" }).format(date);
  return `Dia ${day}, ${weekday}`;
}

/** Formata "12 de outubro de 2026". */
export function formatLongDateBR(value: string | Date): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Formata "agosto de 2026" — usado em títulos de escala. */
export function formatMonthYearBR(value: string | Date): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Data curta com dia da semana + hora — usada em "Últimos acessos". */
export function formatShortDateWithWeekdayAndTime(value: string | Date): string {
  const date = toDate(value);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const time = formatTimeBR(date);
  return `${weekday.replace(".", "")}, ${day} às ${time}`;
}

/** Aceita Date, timestamp ISO com hora, ou "YYYY-MM-DD" puro. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnlyToDate(value);
  return new Date(value);
}

/** "YYYY-MM-DD" de hoje, no fuso da organização. */
export function todayDateOnly(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now); // en-CA => YYYY-MM-DD
}

/** Dia da semana (0=domingo) de uma data pura "YYYY-MM-DD", no fuso local. */
export function weekdayOf(dateOnly: string): number {
  return dateOnlyToDate(dateOnly).getDay();
}

/** Soma dias a uma data pura "YYYY-MM-DD", devolvendo outra data pura. */
export function addDaysDateOnly(dateOnly: string, days: number): string {
  const date = dateOnlyToDate(dateOnly);
  date.setDate(date.getDate() + days);
  return toDateOnlyString(date);
}

/** Converte um Date para "YYYY-MM-DD" usando os componentes locais do próprio Date (sem fuso). */
export function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Domingo da semana que contém `dateOnly`. */
export function startOfWeekSunday(dateOnly: string): string {
  const weekday = weekdayOf(dateOnly);
  return addDaysDateOnly(dateOnly, -weekday);
}

/** Primeiro dia (YYYY-MM-01) do mês/ano informados. */
export function firstDayOfMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-01`;
}

/** Último dia do mês/ano informados, como "YYYY-MM-DD". */
export function lastDayOfMonth(year: number, month1to12: number): string {
  const date = new Date(year, month1to12, 0); // dia 0 do mês seguinte = último dia deste mês
  return toDateOnlyString(date);
}

/** Idade em anos completos, a partir de uma data de nascimento "YYYY-MM-DD". */
export function calculateAge(birthDate: string, onDate: string = todayDateOnly()): number {
  const birth = dateOnlyToDate(birthDate);
  const ref = dateOnlyToDate(onDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    ref.getMonth() > birth.getMonth() ||
    (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** Dias entre duas datas puras "YYYY-MM-DD" (b - a). */
export function diffInDays(a: string | Date, b: string | Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const dateA = toDate(a);
  const dateB = toDate(b);
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}
