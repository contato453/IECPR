import { db, unwrap } from "@/services/supabase";
import { insertRow, updateRow } from "@/features/core/api";
import { addDaysDateOnly, startOfWeekSunday, TIME_ZONE } from "@/lib/date";
import type { DepartmentAgenda, DepartmentAgendaItem, UUID, WorkflowStatus } from "@/types/domain";

/**
 * Prazo padrão de entrega: sábado anterior à semana, 18h, no fuso da
 * organização (regra 6.7). Calculado aqui e espelhado pelo trigger
 * `set_agenda_defaults()` no banco — se algum dia divergirem, o banco vence.
 */
export function defaultDeadline(weekStart: string, timezone: string = TIME_ZONE): Date {
  const saturday = addDaysDateOnly(weekStart, -1);
  // 18h local convertida para um Date real via Intl roundtrip simplificado:
  // como TIME_ZONE é fixo no app, construímos o instante assumindo o offset
  // de America/Sao_Paulo (-03:00, sem DST desde 2019).
  const offset = timezone === "America/Sao_Paulo" ? "-03:00" : "+00:00";
  return new Date(`${saturday}T18:00:00${offset}`);
}

export function isLate(agenda: Pick<DepartmentAgenda, "deadline_at" | "status">): boolean {
  if (agenda.status === "approved" || agenda.status === "published") return false;
  return new Date(agenda.deadline_at).getTime() < Date.now();
}

export async function listDepartmentAgendas(churchId?: UUID | null, departmentId?: UUID | null): Promise<DepartmentAgenda[]> {
  let query = db.from("department_agendas").select("*").is("deleted_at", null).order("week_start", { ascending: false });
  if (churchId) query = query.eq("church_id", churchId);
  if (departmentId) query = query.eq("department_id", departmentId);
  return unwrap(await query) as DepartmentAgenda[];
}

export async function getCurrentWeekAgenda(churchId: UUID, departmentId: UUID): Promise<DepartmentAgenda | null> {
  const weekStart = startOfWeekSunday(new Date().toISOString().slice(0, 10));
  const result = await db
    .from("department_agendas")
    .select("*")
    .eq("church_id", churchId)
    .eq("department_id", departmentId)
    .eq("week_start", weekStart)
    .is("deleted_at", null)
    .maybeSingle();
  return unwrap(result) as DepartmentAgenda | null;
}

export async function createDepartmentAgenda(
  values: Partial<DepartmentAgenda> & { organization_id: UUID; church_id: UUID; department_id: UUID; title: string; week_start: string },
): Promise<DepartmentAgenda> {
  const weekEnd = addDaysDateOnly(values.week_start, 6);
  return insertRow<DepartmentAgenda>("department_agendas", {
    status: "draft",
    version: 1,
    week_end: weekEnd,
    deadline_at: defaultDeadline(values.week_start).toISOString(),
    ...values,
  });
}

export function updateDepartmentAgenda(id: UUID, values: Partial<DepartmentAgenda>): Promise<DepartmentAgenda> {
  return updateRow<DepartmentAgenda>("department_agendas", id, values);
}

export function setDepartmentAgendaStatus(id: UUID, status: WorkflowStatus): Promise<DepartmentAgenda> {
  return updateRow<DepartmentAgenda>("department_agendas", id, { status });
}

export async function listDepartmentAgendaItems(agendaId: UUID): Promise<DepartmentAgendaItem[]> {
  return unwrap(
    await db.from("department_agenda_items").select("*").eq("agenda_id", agendaId).order("sort_order"),
  ) as DepartmentAgendaItem[];
}

export function upsertDepartmentAgendaItem(values: Partial<DepartmentAgendaItem> & { agenda_id: UUID; title: string; item_date: string }): Promise<DepartmentAgendaItem> {
  if (values.id) return updateRow<DepartmentAgendaItem>("department_agenda_items", values.id, values);
  return insertRow<DepartmentAgendaItem>("department_agenda_items", { sort_order: 0, ...values });
}

export async function removeDepartmentAgendaItem(id: UUID): Promise<void> {
  unwrap(await db.from("department_agenda_items").delete().eq("id", id));
}
