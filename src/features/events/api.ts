import { db, unwrap } from "@/services/supabase";
import { listRows, insertRow, updateRow, softDeleteRow } from "@/features/core/api";
import {
  addDaysDateOnly,
  todayDateOnly,
  toDateOnlyString,
  weekdayOf,
} from "@/lib/date";
import type {
  DateOnly,
  EventRecurrence,
  EventRow,
  EventType,
  MaterializedOccurrence,
  Occurrence,
  ProjectedOccurrence,
  UUID,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Identificadores de ocorrência — uuid (materializada) ou "rec:<id>:<data>"
// (projetada). Ver regra de negócio 6.3 — materialização de ocorrências.
// Qualquer identificador de evento que atravesse a URL precisa aceitar as
// duas formas (Bug #2 da documentação de reconstrução).
// ---------------------------------------------------------------------------

export function isProjectedOccurrenceKey(id: string): id is `rec:${string}:${string}` {
  return id.startsWith("rec:");
}

export function parseProjectedOccurrenceKey(key: string): { recurrenceId: UUID; date: DateOnly } {
  const [, recurrenceId, date] = key.split(":");
  if (!recurrenceId || !date) throw new Error(`Chave de ocorrência projetada inválida: ${key}`);
  return { recurrenceId, date };
}

export function makeProjectedOccurrenceKey(recurrenceId: UUID, date: DateOnly): `rec:${UUID}:${DateOnly}` {
  return `rec:${recurrenceId}:${date}`;
}

export function occurrenceId(occurrence: Occurrence): string {
  return occurrence.isProjected ? occurrence.key : occurrence.id;
}

// ---------------------------------------------------------------------------
// Tipos de evento
// ---------------------------------------------------------------------------

export function listEventTypes(): Promise<EventType[]> {
  return listRows<EventType>("event_types", { orderBy: "name" });
}

export function createEventType(values: Partial<EventType> & { organization_id: UUID; name: string }): Promise<EventType> {
  return insertRow<EventType>("event_types", { active: true, allows_lords_supper: false, default_duration_minutes: 60, ...values });
}

export function updateEventType(id: UUID, values: Partial<EventType>): Promise<EventType> {
  return updateRow<EventType>("event_types", id, values);
}

export function deleteEventType(id: UUID): Promise<void> {
  return softDeleteRow("event_types", id);
}

/** É a Escola Bíblica Dominical? Usado para excluir EBD de toda lógica de escala (regra 6.5). */
export function isSundaySchoolEventType(eventType: Pick<EventType, "name">): boolean {
  const normalized = eventType.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return normalized.includes("escola biblica") || normalized.includes("ebd");
}

// ---------------------------------------------------------------------------
// Recorrências
// ---------------------------------------------------------------------------

export async function listEventRecurrences(churchId?: UUID | null): Promise<EventRecurrence[]> {
  let query = db.from("event_recurrences").select("*").is("deleted_at", null).order("weekday").order("start_time");
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as EventRecurrence[];
}

export function createEventRecurrence(
  values: Partial<EventRecurrence> & { organization_id: UUID; event_type_id: UUID; name: string; weekday: number; start_time: string },
): Promise<EventRecurrence> {
  return insertRow<EventRecurrence>("event_recurrences", {
    active: true,
    frequency: "weekly",
    duration_minutes: 60,
    is_campo_wide: false,
    is_shared: false,
    ...values,
  });
}

export async function updateEventRecurrence(id: UUID, values: Partial<EventRecurrence>): Promise<EventRecurrence> {
  const updated = await updateRow<EventRecurrence>("event_recurrences", id, values);
  await syncFutureOccurrences(id, values);
  return updated;
}

export function deleteEventRecurrence(id: UUID): Promise<void> {
  return softDeleteRow("event_recurrences", id);
}

/**
 * Propaga uma mudança de recorrência para as ocorrências futuras já
 * materializadas — sem tocar no passado.
 */
export async function syncFutureOccurrences(recurrenceId: UUID, changes: Partial<EventRecurrence>): Promise<void> {
  const patch: Partial<EventRow> = {};
  if (changes.notes !== undefined) patch.notes = changes.notes;
  if (changes.is_campo_wide !== undefined) patch.is_campo_wide = changes.is_campo_wide;
  if (changes.is_shared !== undefined) patch.is_shared = changes.is_shared;
  if (Object.keys(patch).length === 0) return;

  unwrap(
    await db
      .from("events")
      .update(patch)
      .eq("recurrence_id", recurrenceId)
      .gte("starts_at", todayDateOnly())
      .is("deleted_at", null),
  );
}

// ---------------------------------------------------------------------------
// Eventos avulsos / materializados
// ---------------------------------------------------------------------------

export function createEvent(values: Partial<EventRow> & { organization_id: UUID; event_type_id: UUID; title: string; starts_at: string }): Promise<EventRow> {
  return insertRow<EventRow>("events", {
    cancelled: false,
    has_lords_supper: false,
    is_campo_wide: false,
    is_shared: false,
    ...values,
  });
}

export function updateEvent(id: UUID, values: Partial<EventRow>): Promise<EventRow> {
  return updateRow<EventRow>("events", id, values);
}

export function cancelEvent(id: UUID): Promise<EventRow> {
  return updateRow<EventRow>("events", id, { cancelled: true });
}

export function deleteEvent(id: UUID): Promise<void> {
  return softDeleteRow("events", id);
}

async function listMaterializedEvents(periodStart: DateOnly, periodEnd: DateOnly, churchId?: UUID | null): Promise<EventRow[]> {
  let query = db
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .gte("starts_at", `${periodStart}T00:00:00`)
    .lte("starts_at", `${periodEnd}T23:59:59`)
    .order("starts_at");
  if (churchId) query = query.or(`church_id.eq.${churchId},is_campo_wide.eq.true,is_shared.eq.true`);
  return unwrap(await query) as EventRow[];
}

/** Projeta as datas em que uma recorrência ocorre dentro do período informado. */
function projectRecurrenceDates(recurrence: EventRecurrence, periodStart: DateOnly, periodEnd: DateOnly): DateOnly[] {
  const dates: DateOnly[] = [];
  let cursor = periodStart;
  // avança até o primeiro dia da semana desejado
  while (weekdayOf(cursor) !== recurrence.weekday && cursor <= periodEnd) {
    cursor = addDaysDateOnly(cursor, 1);
  }

  const stepDays = recurrence.frequency === "biweekly" ? 14 : 7;

  while (cursor <= periodEnd) {
    if (recurrence.frequency === "monthly") {
      const weekOfMonth = Math.ceil(Number(cursor.split("-")[2]) / 7);
      if (recurrence.week_of_month == null || weekOfMonth === recurrence.week_of_month) {
        dates.push(cursor);
      }
      cursor = addDaysDateOnly(cursor, 7);
    } else {
      dates.push(cursor);
      cursor = addDaysDateOnly(cursor, stepDays);
    }
  }
  return dates;
}

function toProjectedOccurrence(recurrence: EventRecurrence, eventType: EventType | undefined, date: DateOnly): ProjectedOccurrence {
  const [hh, mm] = recurrence.start_time.split(":");
  const startsAt = `${date}T${hh}:${mm}:00`;
  return {
    key: makeProjectedOccurrenceKey(recurrence.id, date),
    isProjected: true,
    recurrence_id: recurrence.id,
    church_id: recurrence.church_id,
    event_type_id: recurrence.event_type_id,
    title: eventType?.name ?? recurrence.name,
    starts_at: startsAt,
    ends_at: null,
    notes: recurrence.notes,
    is_campo_wide: recurrence.is_campo_wide,
    is_shared: recurrence.is_shared,
    has_lords_supper: false,
  };
}

export interface ListOccurrencesOptions {
  churchId?: UUID | null;
  eventTypeId?: UUID | null;
}

/**
 * Lista as ocorrências (materializadas + projetadas) de um período, já
 * combinadas e ordenadas por data/hora. É a base da Agenda Geral.
 */
export async function listOccurrences(periodStart: DateOnly, periodEnd: DateOnly, options: ListOccurrencesOptions = {}): Promise<Occurrence[]> {
  const [materialized, recurrences, eventTypes] = await Promise.all([
    listMaterializedEvents(periodStart, periodEnd, options.churchId),
    listEventRecurrences(options.churchId ?? undefined),
    listEventTypes(),
  ]);

  const eventTypeById = new Map(eventTypes.map((t) => [t.id, t]));
  const materializedByRecurrenceDate = new Set(
    materialized
      .filter((e) => e.recurrence_id)
      .map((e) => `${e.recurrence_id}:${e.starts_at.slice(0, 10)}`),
  );

  const projected: ProjectedOccurrence[] = [];
  for (const recurrence of recurrences) {
    if (!recurrence.active) continue;
    if (options.churchId && recurrence.church_id && recurrence.church_id !== options.churchId && !recurrence.is_campo_wide && !recurrence.is_shared) {
      continue;
    }
    const dates = projectRecurrenceDates(recurrence, periodStart, periodEnd);
    for (const date of dates) {
      if (materializedByRecurrenceDate.has(`${recurrence.id}:${date}`)) continue;
      projected.push(toProjectedOccurrence(recurrence, eventTypeById.get(recurrence.event_type_id), date));
    }
  }

  const materializedOccurrences: MaterializedOccurrence[] = materialized
    .filter((e) => !e.cancelled)
    .map((e) => ({ ...e, isProjected: false as const }));

  const all: Occurrence[] = [...materializedOccurrences, ...projected].filter((o) => {
    if (!options.eventTypeId) return true;
    return o.event_type_id === options.eventTypeId;
  });

  return all.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * Materializa uma ocorrência projetada (cria a linha real em `events`) ou
 * devolve o evento já existente. Ponto central da regra 6.3 — qualquer ação
 * sobre uma ocorrência passa por aqui antes de gravar dados dependentes
 * (escala, cancelamento, observação).
 */
export async function ensureOccurrence(occurrenceIdOrKey: string, organizationId: UUID): Promise<EventRow> {
  if (!isProjectedOccurrenceKey(occurrenceIdOrKey)) {
    return unwrap(await db.from("events").select("*").eq("id", occurrenceIdOrKey).single()) as EventRow;
  }

  const { recurrenceId, date } = parseProjectedOccurrenceKey(occurrenceIdOrKey);

  const existing = await db
    .from("events")
    .select("*")
    .eq("recurrence_id", recurrenceId)
    .gte("starts_at", `${date}T00:00:00`)
    .lte("starts_at", `${date}T23:59:59`)
    .maybeSingle();
  if (existing.data) return existing.data as EventRow;

  const recurrence = unwrap(await db.from("event_recurrences").select("*").eq("id", recurrenceId).single()) as EventRecurrence;
  const eventType = unwrap(await db.from("event_types").select("*").eq("id", recurrence.event_type_id).single()) as EventType;
  const [hh, mm] = recurrence.start_time.split(":");

  return createEvent({
    organization_id: organizationId,
    church_id: recurrence.church_id,
    event_type_id: recurrence.event_type_id,
    recurrence_id: recurrence.id,
    title: eventType.name,
    starts_at: `${date}T${hh}:${mm}:00`,
    is_campo_wide: recurrence.is_campo_wide,
    is_shared: recurrence.is_shared,
    notes: recurrence.notes,
  });
}

export function occurrenceEndOfMonthRange(year: number, month1to12: number): { periodStart: DateOnly; periodEnd: DateOnly } {
  const periodStart = `${year}-${String(month1to12).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month1to12, 0);
  return { periodStart, periodEnd: toDateOnlyString(lastDay) };
}
