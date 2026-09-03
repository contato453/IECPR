-- IECPR — Migração 4: GRANTs, RLS e policies das tabelas núcleo, e os
-- triggers de updated_at/auditoria.
--
-- Padrão obrigatório repetido tabela a tabela (seção 5 da doc):
--   1. GRANT (Supabase não concede privilégio nenhum por padrão em `public`)
--   2. ENABLE ROW LEVEL SECURITY
--   3. POLICIES — sempre começando por is_active_user() e
--      organization_id = current_org_id()

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
grant select, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create policy "organizations_select" on public.organizations for select to authenticated
  using (is_active_user() and id = current_org_id());
create policy "organizations_update_admin" on public.organizations for update to authenticated
  using (is_active_user() and id = current_org_id() and is_org_admin())
  with check (id = current_org_id());

create trigger set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- churches
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.churches to authenticated;
grant all on public.churches to service_role;
alter table public.churches enable row level security;

create policy "churches_select" on public.churches for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "churches_write_admin" on public.churches for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.churches
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.churches
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.departments to authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;

create policy "departments_select" on public.departments for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "departments_write" on public.departments for all to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or is_department_leader_of(id))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or is_department_leader_of(id))
  );

create trigger set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.departments
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.people to authenticated;
grant all on public.people to service_role;
alter table public.people enable row level security;

create policy "people_select" on public.people for select to authenticated
  using (is_active_user() and organization_id = current_org_id() and can_read_person(id));
-- "Novo cadastro" no PersonCombobox cria um registro só com o nome, antes de
-- a pessoa ter igreja definida (church_id nulo) — por isso a checagem aqui é
-- por TER algum perfil de liderança, não pelo escopo exato da igreja ainda
-- inexistente. people_update (abaixo), já com church_id definido, é mais
-- estrita.
create policy "people_insert" on public.people for insert to authenticated
  with check (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or has_access_profile('church_leader') or has_access_profile('department_leader'))
  );
create policy "people_update" on public.people for update to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id))
  );
create policy "people_delete_admin" on public.people for delete to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.people
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- profiles — NUNCA guarda perfil de acesso (fica em user_access_profiles)
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select to authenticated
  using (organization_id = current_org_id());
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
  using (organization_id = current_org_id() and (id = auth.uid() or is_org_admin()))
  with check (organization_id = current_org_id() and (id = auth.uid() or is_org_admin()));

-- ---------------------------------------------------------------------------
-- ministerial_roles
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.ministerial_roles to authenticated;
grant all on public.ministerial_roles to service_role;
alter table public.ministerial_roles enable row level security;

create policy "ministerial_roles_select" on public.ministerial_roles for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "ministerial_roles_write_admin" on public.ministerial_roles for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.ministerial_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- person_qualifications
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.person_qualifications to authenticated;
grant all on public.person_qualifications to service_role;
alter table public.person_qualifications enable row level security;

create policy "person_qualifications_select" on public.person_qualifications for select to authenticated
  using (is_active_user() and can_read_person(person_id));
create policy "person_qualifications_write" on public.person_qualifications for all to authenticated
  using (
    is_active_user() and exists (
      select 1 from public.people p
      where p.id = person_id and (is_org_admin() or is_church_leader_of(p.church_id))
    )
  );

-- ---------------------------------------------------------------------------
-- person_roles (vínculo puro — DELETE real, sem exclusão lógica)
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.person_roles to authenticated;
grant all on public.person_roles to service_role;
alter table public.person_roles enable row level security;

create policy "person_roles_select" on public.person_roles for select to authenticated
  using (is_active_user() and can_read_person(person_id));
create policy "person_roles_write_admin" on public.person_roles for all to authenticated
  using (is_active_user() and is_org_admin());

-- ---------------------------------------------------------------------------
-- user_access_profiles — só o pastor administrador escreve. Ver leitura:
-- cada usuário enxerga a própria linha; admin enxerga todas da organização.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.user_access_profiles to authenticated;
grant all on public.user_access_profiles to service_role;
alter table public.user_access_profiles enable row level security;

create policy "user_access_profiles_select" on public.user_access_profiles for select to authenticated
  using (organization_id = current_org_id() and (user_id = auth.uid() or is_org_admin()));
create policy "user_access_profiles_write_admin" on public.user_access_profiles for all to authenticated
  using (organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;

create policy "settings_select_admin" on public.settings for select to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin());
create policy "settings_write_admin" on public.settings for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log — append-only. Sem policy de INSERT para `authenticated`: só a
-- função write_audit() (SECURITY DEFINER, dono bypassa RLS) grava aqui.
-- ---------------------------------------------------------------------------
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log for select to authenticated
  using (organization_id = current_org_id() and is_org_admin());
