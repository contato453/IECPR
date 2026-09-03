-- IECPR — Migração 8: notificações (templates, jobs, tentativas) e
-- notificações internas. O envio real (WhatsApp) fica em modo mock — ver
-- src/features/notifications/api.ts.

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  channel public.notification_channel not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid references public.churches(id),
  template_id uuid references public.notification_templates(id),
  schedule_item_id uuid references public.schedule_items(id),
  person_id uuid references public.people(id),
  channel public.notification_channel not null,
  destination text not null,
  message text not null,
  status public.notification_status not null default 'queued',
  attempt_count integer not null default 0,
  last_error text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_jobs_org_idx on public.notification_jobs(organization_id, created_at desc);
create index notification_jobs_church_idx on public.notification_jobs(church_id);

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  attempt_number integer not null,
  status public.notification_status not null,
  provider text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_number)
);

create table public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id),
  department_id uuid references public.departments(id),
  title text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index in_app_notifications_user_idx on public.in_app_notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- GRANTs, RLS e policies
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.notification_templates to authenticated;
grant all on public.notification_templates to service_role;
alter table public.notification_templates enable row level security;

create policy "notification_templates_select" on public.notification_templates for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "notification_templates_write_admin" on public.notification_templates for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

grant select, insert, update on public.notification_jobs to authenticated;
grant all on public.notification_jobs to service_role;
alter table public.notification_jobs enable row level security;

create policy "notification_jobs_select" on public.notification_jobs for select to authenticated
  using (is_active_user() and organization_id = current_org_id() and (is_org_admin() or has_church_scope(church_id)));
create policy "notification_jobs_write" on public.notification_jobs for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and (is_org_admin() or is_church_leader_of(church_id)))
  with check (organization_id = current_org_id() and (is_org_admin() or is_church_leader_of(church_id)));

grant select, insert on public.notification_attempts to authenticated;
grant all on public.notification_attempts to service_role;
alter table public.notification_attempts enable row level security;

create policy "notification_attempts_select" on public.notification_attempts for select to authenticated
  using (
    exists (
      select 1 from public.notification_jobs j
      where j.id = job_id and is_active_user() and j.organization_id = current_org_id()
        and (is_org_admin() or has_church_scope(j.church_id))
    )
  );
create policy "notification_attempts_insert" on public.notification_attempts for insert to authenticated
  with check (
    exists (
      select 1 from public.notification_jobs j
      where j.id = job_id and is_active_user() and j.organization_id = current_org_id()
        and (is_org_admin() or is_church_leader_of(j.church_id))
    )
  );

grant select, update on public.in_app_notifications to authenticated;
grant all on public.in_app_notifications to service_role;
alter table public.in_app_notifications enable row level security;

create policy "in_app_notifications_select_own" on public.in_app_notifications for select to authenticated
  using (user_id = auth.uid());
create policy "in_app_notifications_update_own" on public.in_app_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
