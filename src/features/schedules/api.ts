import { db, unwrap } from "@/services/supabase";
import { insertRow, updateRow } from "@/features/core/api";
import { ensureOccurrence, isSundaySchoolEventType } from "@/features/events/api";
import { formatMonthYearBR, firstDayOfMonth, lastDayOfMonth } from "@/lib/date";
import type {
  Confirmation,
  ConfirmationStatus,
  EventRow,
  EventType,
  Occurrence,
  Schedule,
  ScheduleItem,
  ScheduleItemKind,
  UUID,
  WorkflowStatus,
} from "@/types/domain";
import { occurrenceId } from "@/features/events/api";

// ---------------------------------------------------------------------------
// Escalas — uma escala cobre um mês, uma igreja (regra 6.5).
// ---------------------------------------------------------------------------

export async function listSchedules(churchId?: UUID | null): Promise<Schedule[]> {
  let query = db.from("schedules").select("*").is("deleted_at", null).order("period_start", { ascending: false });
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as Schedule[];
}

export async function getSchedule(id: UUID): Promise<Schedule> {
  return unwrap(await db.from("schedules").select("*").eq("id", id).single()) as Schedule;
}

export async function listScheduleItems(scheduleId: UUID): Promise<ScheduleItem[]> {
  return unwrap(
    await db.from("schedule_items").select("*").eq("schedule_id", scheduleId).order("sort_order"),
  ) as ScheduleItem[];
}

export interface ScheduleItemWithPerson extends ScheduleItem {
  people: { full_name: string; phone: string | null } | null;
}

/** Busca em lote os itens de escala de vários eventos materializados de uma vez — usado pela Agenda Geral. */
export async function listScheduleItemsByEventIds(eventIds: UUID[]): Promise<ScheduleItemWithPerson[]> {
  if (eventIds.length === 0) return [];
  return unwrap(
    await db.from("schedule_items").select("*, people(full_name, phone)").in("event_id", eventIds),
  ) as ScheduleItemWithPerson[];
}

/**
 * Cria (ou reaproveita) a escala do mês/igreja de uma data — é assim que
 * toda escala nasce: nunca manualmente, sempre a partir de um clique
 * "Atribuir escala" na Agenda Geral (regra 6.5, decisão de produto #9).
 */
export async function createScheduleForDate(organizationId: UUID, churchId: UUID, dateOnly: string): Promise<Schedule> {
  const [year, month] = dateOnly.split("-").map(Number) as [number, number];
  const periodStart = firstDayOfMonth(year, month);
  const periodEnd = lastDayOfMonth(year, month);

  const existing = await db
    .from("schedules")
    .select("*")
    .eq("church_id", churchId)
    .eq("period_start", periodStart)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.data) return existing.data as Schedule;

  const church = unwrap(await db.from("churches").select("short_name").eq("id", churchId).single()) as { short_name: string };
  const title = `${church.short_name} · ${formatMonthYearBR(periodStart)}`;

  return insertRow<Schedule>("schedules", {
    organization_id: organizationId,
    church_id: churchId,
    title,
    period_start: periodStart,
    period_end: periodEnd,
    status: "draft",
    version: 1,
  });
}

/** Garante a escala do mês E a ocorrência materializada, num só passo. */
export async function createScheduleAndOccurrenceForEvent(
  organizationId: UUID,
  occurrence: Occurrence,
): Promise<{ schedule: Schedule; event: EventRow }> {
  const event = await ensureOccurrence(occurrenceId(occurrence), organizationId);
  const churchId = event.church_id ?? (await resolveHeadquartersChurchId(organizationId));
  const schedule = await createScheduleForDate(organizationId, churchId, event.starts_at.slice(0, 10));
  return { schedule, event };
}

async function resolveHeadquartersChurchId(organizationId: UUID): Promise<UUID> {
  const church = unwrap(
    await db.from("churches").select("id").eq("organization_id", organizationId).eq("is_headquarters", true).single(),
  ) as { id: UUID };
  return church.id;
}

export async function upsertScheduleItem(values: Partial<ScheduleItem> & { schedule_id: UUID; kind: ScheduleItemKind }): Promise<ScheduleItem> {
  if (values.id) {
    return updateRow<ScheduleItem>("schedule_items", values.id, values);
  }
  return insertRow<ScheduleItem>("schedule_items", { sort_order: 0, ...values });
}

export async function removeScheduleItem(id: UUID): Promise<void> {
  unwrap(await db.from("schedule_items").delete().eq("id", id));
}

/**
 * Detecção de conflito — decisão de produto: qualquer pessoa cadastrada pode
 * ser escalada em qualquer função, em qualquer igreja, e pode acumular
 * funções no mesmo evento. Por isso esta função é intencionalmente vazia
 * (ver histórico de decisões #6, #7, #8 e Bugs #4/#5 da documentação).
 */
export function findConflicts(_items: ScheduleItem[]): Set<UUID> {
  return new Set<UUID>();
}

export interface OccurrenceScheduleStatus {
  hasLeader: boolean;
  hasPreacher: boolean;
  isComplete: boolean;
  isExempt: boolean; // EBD não tem escala
}

/**
 * Escala completa = dirigente + pregador. EBD é excluída de toda a lógica
 * (regra 6.5) — nunca mostra badge de pendência.
 */
export function computeOccurrenceStatus(
  eventType: EventType | undefined,
  items: ScheduleItem[],
): OccurrenceScheduleStatus {
  if (eventType && isSundaySchoolEventType(eventType)) {
    return { hasLeader: true, hasPreacher: true, isComplete: true, isExempt: true };
  }
  const hasLeader = items.some((i) => i.kind === "leader" && i.person_id);
  const hasPreacher = items.some((i) => i.kind === "preacher" && i.person_id);
  return { hasLeader, hasPreacher, isComplete: hasLeader && hasPreacher, isExempt: false };
}

// ---------------------------------------------------------------------------
// Confirmações
// ---------------------------------------------------------------------------

export async function listConfirmations(churchId?: UUID | null): Promise<Confirmation[]> {
  let query = db.from("confirmations").select("*").order("responded_at", { ascending: false, nullsFirst: true });
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as Confirmation[];
}

export interface ConfirmationDetailed extends Confirmation {
  people: { full_name: string } | null;
  schedule_items: { kind: ScheduleItemKind; events: { title: string; starts_at: string } | null } | null;
}

export async function listConfirmationsDetailed(churchId?: UUID | null): Promise<ConfirmationDetailed[]> {
  let query = db
    .from("confirmations")
    .select("*, people(full_name), schedule_items(kind, events(title, starts_at))")
    .order("responded_at", { ascending: false, nullsFirst: true });
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as ConfirmationDetailed[];
}

export async function respondConfirmation(
  id: UUID,
  status: ConfirmationStatus,
  replacementPersonId?: UUID | null,
): Promise<Confirmation> {
  return updateRow<Confirmation>("confirmations", id, {
    status,
    responded_at: new Date().toISOString(),
    replacement_person_id: replacementPersonId ?? null,
  });
}

/** Confirmações pendentes de uma pessoa, já com o event_id do item de escala — usada pela Agenda Geral. */
export async function listMyPendingConfirmations(personId: UUID): Promise<{ id: UUID; event_id: UUID | null; status: ConfirmationStatus }[]> {
  const rows = unwrap(
    await db.from("confirmations").select("id, status, schedule_items(event_id)").eq("person_id", personId).eq("status", "pending"),
  ) as unknown as { id: UUID; status: ConfirmationStatus; schedule_items: { event_id: UUID | null } | null }[];
  return rows.map((r) => ({ id: r.id, status: r.status, event_id: r.schedule_items?.event_id ?? null }));
}

// ---------------------------------------------------------------------------
// Workflow — ver src/features/workflow.ts para a máquina de estados completa
// ---------------------------------------------------------------------------

export async function setScheduleStatus(id: UUID, status: WorkflowStatus): Promise<Schedule> {
  const updated = await updateRow<Schedule>("schedules", id, { status });
  if (status === "published") {
    unwrap(await db.rpc("queue_schedule_confirmations", { _schedule_id: id }));
  }
  return updated;
}

/** Reabre uma escala aprovada/publicada, gerando uma nova versão em rascunho. */
export async function reopenSchedule(id: UUID): Promise<Schedule> {
  unwrap(await db.rpc("reopen_schedule", { _schedule_id: id }));
  return getSchedule(id);
}
