import { db, unwrap } from "@/services/supabase";
import type { Confirmation, DepartmentAgenda, ScheduleItem, UUID } from "@/types/domain";
import { isLate } from "@/features/agendas/api";

export interface DeadlineComplianceReport {
  onTime: number;
  late: number;
  total: number;
  ratePercent: number;
}

export async function reportDeadlineCompliance(organizationId: UUID): Promise<DeadlineComplianceReport> {
  const agendas = unwrap(
    await db.from("department_agendas").select("*").eq("organization_id", organizationId).is("deleted_at", null),
  ) as DepartmentAgenda[];
  const total = agendas.length;
  const late = agendas.filter((a) => isLate(a) || (a.status !== "draft" && new Date(a.updated_at) > new Date(a.deadline_at))).length;
  const onTime = total - late;
  return { onTime, late, total, ratePercent: total === 0 ? 100 : Math.round((onTime / total) * 100) };
}

export interface ConfirmationReport {
  confirmed: number;
  declined: number;
  pending: number;
  total: number;
}

export async function reportConfirmations(churchId?: UUID | null): Promise<ConfirmationReport> {
  let query = db.from("confirmations").select("status");
  if (churchId) query = query.eq("church_id", churchId);
  const rows = unwrap(await query) as Pick<Confirmation, "status">[];
  return {
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    declined: rows.filter((r) => r.status === "declined" || r.status === "replaced").length,
    pending: rows.filter((r) => r.status === "pending").length,
    total: rows.length,
  };
}

export interface PersonScheduleCount {
  personId: UUID;
  fullName: string;
  count: number;
}

export async function reportSchedulesByPerson(organizationId: UUID): Promise<PersonScheduleCount[]> {
  const rows = unwrap(
    await db
      .from("schedule_items")
      .select("person_id, people(full_name), schedules!inner(organization_id)")
      .eq("schedules.organization_id", organizationId)
      .not("person_id", "is", null),
  ) as unknown as { person_id: UUID; people: { full_name: string } | null }[];

  const counts = new Map<string, PersonScheduleCount>();
  for (const row of rows) {
    const key = row.person_id;
    const current = counts.get(key) ?? { personId: key, fullName: row.people?.full_name ?? "—", count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export interface ApprovalTimeReport {
  averageHours: number;
  samples: number;
}

/** Tempo médio entre criação e publicação das escalas — aproximação por created_at/updated_at. */
export async function reportApprovalTime(organizationId: UUID): Promise<ApprovalTimeReport> {
  const rows = unwrap(
    await db.from("schedules").select("created_at, updated_at, status").eq("organization_id", organizationId).eq("status", "published"),
  ) as { created_at: string; updated_at: string }[];

  if (rows.length === 0) return { averageHours: 0, samples: 0 };
  const totalHours = rows.reduce((sum, r) => sum + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0);
  return { averageHours: Math.round((totalHours / rows.length) * 10) / 10, samples: rows.length };
}

export function countScheduleItemsByKind(items: ScheduleItem[]) {
  return {
    leader: items.filter((i) => i.kind === "leader" && i.person_id).length,
    preacher: items.filter((i) => i.kind === "preacher" && i.person_id).length,
    opportunity: items.filter((i) => i.kind === "opportunity" && i.person_id).length,
  };
}
