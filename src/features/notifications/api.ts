import { db, unwrap } from "@/services/supabase";
import { insertRow, updateRow } from "@/features/core/api";
import type { NotificationAttempt, NotificationChannel, NotificationJob, NotificationTemplate, UUID } from "@/types/domain";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  return unwrap(await db.from("notification_templates").select("*").is("deleted_at", null).order("name")) as NotificationTemplate[];
}

export function createNotificationTemplate(values: Partial<NotificationTemplate> & { organization_id: UUID; name: string; channel: NotificationChannel; body: string }): Promise<NotificationTemplate> {
  return insertRow<NotificationTemplate>("notification_templates", { active: true, ...values });
}

export function updateNotificationTemplate(id: UUID, values: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
  return updateRow<NotificationTemplate>("notification_templates", id, values);
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// ---------------------------------------------------------------------------
// Jobs e tentativas — camada de serviço com adaptador MOCK.
// A integração real com um provedor de WhatsApp fica fora deste app: o
// token do provedor nunca pode ir ao navegador (ver Pontos em aberto da
// documentação). `dispatchMockJob` simula envio local, síncrono, sem rede.
// ---------------------------------------------------------------------------

export async function listNotificationJobs(churchId?: UUID | null): Promise<NotificationJob[]> {
  let query = db.from("notification_jobs").select("*").order("created_at", { ascending: false }).limit(200);
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as NotificationJob[];
}

export async function enqueueNotificationJob(
  values: Partial<NotificationJob> & { organization_id: UUID; channel: NotificationChannel; destination: string; message: string },
): Promise<NotificationJob> {
  return insertRow<NotificationJob>("notification_jobs", { status: "queued", attempt_count: 0, ...values });
}

/** Chave de idempotência simples: evita reenvio duplicado do mesmo job/pessoa/evento. */
export function notificationIdempotencyKey(scheduleItemId: UUID, personId: UUID, channel: NotificationChannel): string {
  return `${scheduleItemId}:${personId}:${channel}`;
}

/** Adaptador mock — troque por uma chamada real de provedor quando disponível. */
export async function dispatchMockJob(jobId: UUID): Promise<NotificationAttempt> {
  const job = unwrap(await db.from("notification_jobs").select("*").eq("id", jobId).single()) as NotificationJob;
  const attemptNumber = job.attempt_count + 1;

  const attempt = await insertRow<NotificationAttempt>("notification_attempts", {
    job_id: jobId,
    attempt_number: attemptNumber,
    status: "sent",
    provider: "mock",
    provider_response: { ok: true, simulated: true },
  });

  await updateRow<NotificationJob>("notification_jobs", jobId, {
    status: "sent",
    attempt_count: attemptNumber,
    sent_at: new Date().toISOString(),
  });

  return attempt;
}

export async function listNotificationAttempts(jobId: UUID): Promise<NotificationAttempt[]> {
  return unwrap(
    await db.from("notification_attempts").select("*").eq("job_id", jobId).order("attempt_number"),
  ) as NotificationAttempt[];
}
