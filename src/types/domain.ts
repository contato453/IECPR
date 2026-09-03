/**
 * Tipos de domínio compartilhados — espelham os enums e tabelas do schema
 * `public` do Supabase (ver supabase/migrations).
 */

export type UUID = string;
export type ISODateTime = string;
export type DateOnly = string; // "YYYY-MM-DD"

export type AccessProfile = "pastor_admin" | "church_leader" | "department_leader" | "ministerial_viewer";

export type MinisterialQualification =
  | "pastor_president"
  | "assistant_pastor"
  | "pastor"
  | "evangelist"
  | "presbyter"
  | "deacon"
  | "missionary"
  | "cooperator"
  | "sunday_school_teacher"
  | "member";

export type WorkflowStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "returned"
  | "rejected"
  | "published"
  | "cancelled";

export type ScheduleItemKind = "leader" | "preacher" | "opportunity";
export type ConfirmationStatus = "pending" | "confirmed" | "declined" | "replaced";
export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
export type NotificationChannel = "whatsapp" | "email" | "manual";
export type NotificationStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";
export type PersonSituation = "ativo" | "desligado" | "excluído" | "falecido" | "transferido";

export interface BaseRow {
  id: UUID;
  organization_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  deleted_at: ISODateTime | null;
}

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  timezone: string;
  active: boolean;
}

export interface Church extends BaseRow {
  name: string;
  short_name: string;
  city: string | null;
  is_headquarters: boolean;
  active: boolean;
}

export interface Department extends BaseRow {
  church_id: UUID | null;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Person extends BaseRow {
  church_id: UUID | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: DateOnly | null;
  notes: string | null;
  situation: PersonSituation;
  active: boolean;
}

export interface Profile {
  id: UUID;
  organization_id: UUID;
  person_id: UUID | null;
  full_name: string;
  email: string;
  active: boolean;
  last_login: ISODateTime | null;
}

export interface MinisterialRole extends BaseRow {
  name: string;
  description: string | null;
  active: boolean;
}

export interface PersonQualification {
  id: UUID;
  person_id: UUID;
  qualification: MinisterialQualification;
  granted_on: DateOnly | null;
  notes: string | null;
}

export interface PersonRole {
  id: UUID;
  person_id: UUID;
  ministerial_role_id: UUID;
}

export interface UserAccessProfile {
  id: UUID;
  user_id: UUID;
  organization_id: UUID;
  profile: AccessProfile;
  church_id: UUID | null;
  department_id: UUID | null;
}

export interface AuditLogEntry {
  id: UUID;
  organization_id: UUID;
  actor_user_id: UUID | null;
  entity: string;
  entity_id: UUID | null;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: ISODateTime;
}

export interface EventType extends BaseRow {
  name: string;
  allows_lords_supper: boolean;
  default_duration_minutes: number;
  creation_permission: AccessProfile | null;
  active: boolean;
}

export interface EventRecurrence extends BaseRow {
  church_id: UUID | null;
  event_type_id: UUID;
  name: string;
  frequency: RecurrenceFrequency;
  weekday: number; // 0 = domingo
  week_of_month: number | null;
  start_time: string; // "HH:MM:SS"
  duration_minutes: number;
  is_campo_wide: boolean;
  is_shared: boolean;
  notes: string | null;
  active: boolean;
}

export interface EventRow extends BaseRow {
  church_id: UUID | null;
  event_type_id: UUID;
  recurrence_id: UUID | null;
  title: string;
  starts_at: ISODateTime;
  ends_at: ISODateTime | null;
  has_lords_supper: boolean;
  notes: string | null;
  cancelled: boolean;
  is_campo_wide: boolean;
  is_shared: boolean;
}

/** Ocorrência projetada de uma recorrência ainda não materializada em `events`. */
export interface ProjectedOccurrence {
  key: `rec:${UUID}:${DateOnly}`;
  isProjected: true;
  recurrence_id: UUID;
  church_id: UUID | null;
  event_type_id: UUID;
  title: string;
  starts_at: ISODateTime;
  ends_at: ISODateTime | null;
  notes: string | null;
  is_campo_wide: boolean;
  is_shared: boolean;
  has_lords_supper: boolean;
}

export interface MaterializedOccurrence extends EventRow {
  isProjected: false;
}

export type Occurrence = ProjectedOccurrence | MaterializedOccurrence;

export interface Schedule extends BaseRow {
  church_id: UUID;
  title: string;
  period_start: DateOnly;
  period_end: DateOnly;
  status: WorkflowStatus;
  version: number;
  notes: string | null;
  created_by: UUID | null;
}

export interface ScheduleItem {
  id: UUID;
  schedule_id: UUID;
  event_id: UUID | null;
  kind: ScheduleItemKind;
  person_id: UUID | null;
  department_id: UUID | null;
  opportunity_label: string | null;
  notes: string | null;
  sort_order: number;
}

export interface ScheduleVersion {
  id: UUID;
  schedule_id: UUID;
  version: number;
  status: WorkflowStatus;
  snapshot: unknown;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface Confirmation {
  id: UUID;
  schedule_item_id: UUID;
  person_id: UUID;
  church_id: UUID;
  status: ConfirmationStatus;
  responded_at: ISODateTime | null;
  replacement_person_id: UUID | null;
  notes: string | null;
}

export interface DepartmentAgenda extends BaseRow {
  church_id: UUID;
  department_id: UUID;
  title: string;
  week_start: DateOnly;
  week_end: DateOnly;
  deadline_at: ISODateTime;
  status: WorkflowStatus;
  version: number;
  notes: string | null;
  created_by: UUID | null;
}

export interface DepartmentAgendaItem {
  id: UUID;
  agenda_id: UUID;
  title: string;
  description: string | null;
  item_date: DateOnly;
  start_time: string | null;
  responsible_person_id: UUID | null;
  sort_order: number;
}

export interface NotificationTemplate extends BaseRow {
  name: string;
  channel: NotificationChannel;
  body: string;
  active: boolean;
}

export interface NotificationJob {
  id: UUID;
  organization_id: UUID;
  church_id: UUID | null;
  template_id: UUID | null;
  schedule_item_id: UUID | null;
  person_id: UUID | null;
  channel: NotificationChannel;
  destination: string;
  message: string;
  status: NotificationStatus;
  attempt_count: number;
  last_error: string | null;
  scheduled_for: ISODateTime | null;
  sent_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface NotificationAttempt {
  id: UUID;
  job_id: UUID;
  attempt_number: number;
  status: NotificationStatus;
  provider: string | null;
  provider_response: unknown;
  created_at: ISODateTime;
}

export interface InAppNotification {
  id: UUID;
  user_id: UUID;
  church_id: UUID | null;
  department_id: UUID | null;
  title: string;
  message: string;
  link: string | null;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface Setting {
  id: UUID;
  organization_id: UUID;
  key: string;
  value: unknown;
}
