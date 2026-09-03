import { db, unwrap } from "@/services/supabase";
import type {
  AccessProfile,
  Church,
  Department,
  MinisterialRole,
  Person,
  PersonQualification,
  PersonSituation,
  Profile,
  UserAccessProfile,
  UUID,
} from "@/types/domain";

/** Departamentos que toda igreja deve ter ao ser criada (ver regra de negócio 6.10). */
export const DEFAULT_DEPARTMENTS = ["DEPIN", "Homens", "Jovens", "Mulheres"] as const;

// ---------------------------------------------------------------------------
// CRUD genérico
// ---------------------------------------------------------------------------

export async function listRows<T>(table: string, opts?: { orderBy?: string; ascending?: boolean }): Promise<T[]> {
  let query = db.from(table).select("*").is("deleted_at", null);
  if (opts?.orderBy) query = query.order(opts.orderBy, { ascending: opts.ascending ?? true });
  return unwrap(await query) as T[];
}

export async function insertRow<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const result = await db.from(table).insert(values).select().single();
  return unwrap(result) as T;
}

export async function updateRow<T>(table: string, id: UUID, values: Record<string, unknown>): Promise<T> {
  const result = await db.from(table).update(values).eq("id", id).select().single();
  return unwrap(result) as T;
}

/** Exclusão lógica — nada de negócio é apagado fisicamente (regra 6.2). */
export async function softDeleteRow(table: string, id: UUID): Promise<void> {
  unwrap(await db.from(table).update({ deleted_at: new Date().toISOString(), active: false }).eq("id", id));
}

/** Tabelas de vínculo puro (ex.: person_roles) usam DELETE real. */
export async function hardDeleteRow(table: string, id: UUID): Promise<void> {
  unwrap(await db.from(table).delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Igrejas
// ---------------------------------------------------------------------------

export function listChurches(): Promise<Church[]> {
  return listRows<Church>("churches", { orderBy: "name" });
}

export function createChurch(values: Partial<Church>): Promise<Church> {
  return insertRow<Church>("churches", values);
}

export function updateChurch(id: UUID, values: Partial<Church>): Promise<Church> {
  return updateRow<Church>("churches", id, values);
}

/** Cria a igreja e, junto, os 4 departamentos padrão (regra 6.10). */
export async function createChurchWithDefaultDepartments(values: Partial<Church>): Promise<Church> {
  const church = await createChurch(values);
  await Promise.all(
    DEFAULT_DEPARTMENTS.map((name) =>
      createDepartment({ church_id: church.id, name, organization_id: church.organization_id }),
    ),
  );
  return church;
}

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

export async function listDepartments(churchId?: UUID | null): Promise<Department[]> {
  let query = db.from("departments").select("*").is("deleted_at", null).order("name");
  if (churchId) query = query.eq("church_id", churchId);
  return unwrap(await query) as Department[];
}

export function createDepartment(values: Partial<Department> & { organization_id: UUID }): Promise<Department> {
  return insertRow<Department>("departments", values);
}

export function updateDepartment(id: UUID, values: Partial<Department>): Promise<Department> {
  return updateRow<Department>("departments", id, values);
}

// ---------------------------------------------------------------------------
// Pessoas / Membros
// ---------------------------------------------------------------------------

export interface PersonFilters {
  churchId?: UUID | null;
  situation?: PersonSituation | null;
  search?: string;
  includeInactive?: boolean;
}

export interface PersonWithQualifications extends Person {
  person_qualifications: PersonQualification[];
}

export async function listPeople(filters: PersonFilters = {}): Promise<PersonWithQualifications[]> {
  let query = db
    .from("people")
    .select("*, person_qualifications(*)")
    .is("deleted_at", null)
    .order("full_name");
  if (!filters.includeInactive) query = query.eq("situation", "ativo");
  if (filters.churchId) query = query.eq("church_id", filters.churchId);
  if (filters.situation) query = query.eq("situation", filters.situation);
  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
  return unwrap(await query) as PersonWithQualifications[];
}

/** Busca por nome, a partir de 3 caracteres — usada pelo PersonCombobox. */
export async function searchPeopleByName(term: string): Promise<Person[]> {
  if (term.trim().length < 3) return [];
  return unwrap(
    await db.from("people").select("*").is("deleted_at", null).ilike("full_name", `%${term.trim()}%`).order("full_name").limit(20),
  ) as Person[];
}

export function createPerson(values: Partial<Person> & { organization_id: UUID; full_name: string }): Promise<Person> {
  return insertRow<Person>("people", { situation: "ativo", active: true, ...values });
}

export function updatePerson(id: UUID, values: Partial<Person>): Promise<Person> {
  return updateRow<Person>("people", id, values);
}

/**
 * Cadastro incompleto quando falta telefone, e-mail, data de nascimento,
 * igreja ou qualificação (regra 6.9). Observações não contam.
 */
export function isPersonIncomplete(person: PersonWithQualifications): boolean {
  return (
    !person.phone ||
    !person.email ||
    !person.birth_date ||
    !person.church_id ||
    person.person_qualifications.length === 0
  );
}

/** Substitui o conjunto de qualificações de uma pessoa via RPC do banco. */
export async function syncPersonQualifications(personId: UUID, qualifications: string[]): Promise<void> {
  unwrap(await db.rpc("sync_person_qualifications", { _person_id: personId, _qualifications: qualifications }));
}

/** Aniversariantes do mês informado (1-12), ordenados por dia. */
export async function listBirthdaysInMonth(month1to12: number): Promise<PersonWithQualifications[]> {
  const people = unwrap(
    await db
      .from("people")
      .select("*, person_qualifications(*)")
      .is("deleted_at", null)
      .eq("situation", "ativo")
      .not("birth_date", "is", null),
  ) as PersonWithQualifications[];

  return people
    .filter((p) => p.birth_date && Number(p.birth_date.split("-")[1]) === month1to12)
    .sort((a, b) => Number(a.birth_date!.split("-")[2]) - Number(b.birth_date!.split("-")[2]));
}

// ---------------------------------------------------------------------------
// Qualificações (cargos ministeriais) e papéis
// ---------------------------------------------------------------------------

export function listMinisterialRoles(): Promise<MinisterialRole[]> {
  return listRows<MinisterialRole>("ministerial_roles", { orderBy: "name" });
}

// ---------------------------------------------------------------------------
// Perfis de acesso e usuários
// ---------------------------------------------------------------------------

export interface UserWithAccess extends Profile {
  user_access_profiles: UserAccessProfile[];
}

export async function listUsers(): Promise<UserWithAccess[]> {
  return unwrap(
    await db.from("profiles").select("*, user_access_profiles(*)").order("full_name"),
  ) as UserWithAccess[];
}

export async function getMyAccessProfiles(userId: UUID): Promise<UserAccessProfile[]> {
  return unwrap(await db.from("user_access_profiles").select("*").eq("user_id", userId)) as UserAccessProfile[];
}

export async function getMyProfile(userId: UUID): Promise<Profile | null> {
  const result = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  return unwrap(result) as Profile | null;
}

export function accessProfileLabelsList(): AccessProfile[] {
  return ["pastor_admin", "church_leader", "department_leader", "ministerial_viewer"];
}

export async function grantAccessProfile(values: Omit<UserAccessProfile, "id">): Promise<UserAccessProfile> {
  return insertRow<UserAccessProfile>("user_access_profiles", values);
}

export async function revokeAccessProfile(id: UUID): Promise<void> {
  await hardDeleteRow("user_access_profiles", id);
}

// ---------------------------------------------------------------------------
// Painel — Quadro Ministerial e Últimos acessos
// ---------------------------------------------------------------------------

export interface MinisterialBoardCounts {
  pastor_president: number;
  assistant_pastor: number;
  pastor: number;
  evangelist: number;
  presbyter: number;
  deacon: number;
  missionary: number;
  cooperator: number;
  member: number;
}

/** Contagem em tempo real de pastores, presbíteros, evangelistas, diáconos, missionários, cooperadores e membros. */
export async function getMinisterialBoardCounts(): Promise<MinisterialBoardCounts> {
  const rows = unwrap(
    await db
      .from("person_qualifications")
      .select("qualification, people!inner(situation, deleted_at)")
      .eq("people.situation", "ativo")
      .is("people.deleted_at", null),
  ) as { qualification: keyof MinisterialBoardCounts }[];

  const counts: MinisterialBoardCounts = {
    pastor_president: 0,
    assistant_pastor: 0,
    pastor: 0,
    evangelist: 0,
    presbyter: 0,
    deacon: 0,
    missionary: 0,
    cooperator: 0,
    member: 0,
  };
  for (const row of rows) {
    if (row.qualification in counts) counts[row.qualification] += 1;
  }
  return counts;
}

export interface RecentLogin {
  userId: UUID;
  fullName: string;
  lastLogin: string;
}

/** As 10 últimas pessoas distintas que logaram (uma linha por pessoa, login mais recente). */
export async function listRecentLogins(limit = 10): Promise<RecentLogin[]> {
  const rows = unwrap(
    await db.from("profiles").select("id, full_name, last_login").not("last_login", "is", null).order("last_login", { ascending: false }).limit(limit),
  ) as { id: UUID; full_name: string; last_login: string }[];
  return rows.map((r) => ({ userId: r.id, fullName: r.full_name, lastLogin: r.last_login }));
}

// ---------------------------------------------------------------------------
// Configurações e auditoria
// ---------------------------------------------------------------------------

export async function listAuditLog(limit = 200) {
  return unwrap(
    await db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit),
  );
}

export async function getSetting(key: string): Promise<unknown | null> {
  const result = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const row = unwrap(result) as { value: unknown } | null;
  return row?.value ?? null;
}

export async function setSetting(organizationId: UUID, key: string, value: unknown): Promise<void> {
  unwrap(await db.from("settings").upsert({ organization_id: organizationId, key, value }, { onConflict: "organization_id,key" }));
}
