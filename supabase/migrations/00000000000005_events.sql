-- IECPR — Migração 5: eventos e recorrências.
--
-- Conceito central (regra 6.3): uma recorrência não é um evento. A agenda
-- projeta ocorrências futuras em memória (chave "rec:<id>:<data>") e só
-- materializa em `events` quando alguém age sobre a ocorrência. Esta
-- migração cuida só das tabelas — a materialização é 100% client-side
-- (ver src/features/events/api.ts, `ensureOccurrence`).

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  allows_lords_supper boolean not null default false,
  default_duration_minutes integer not null default 60,
  creation_permission public.access_profile,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.event_recurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid references public.churches(id), -- nulo quando is_campo_wide
  event_type_id uuid not null references public.event_types(id),
  name text not null,
  frequency public.recurrence_frequency not null default 'weekly',
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  week_of_month smallint check (week_of_month between 1 and 5),
  start_time time not null,
  duration_minutes integer not null default 60,
  is_campo_wide boolean not null default false,
  is_shared boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (not is_campo_wide or church_id is null)
);
create index event_recurrences_church_idx on public.event_recurrences(church_id) where deleted_at is null;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid references public.churches(id), -- nulo quando is_campo_wide
  event_type_id uuid not null references public.event_types(id),
  recurrence_id uuid references public.event_recurrences(id),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  has_lords_supper boolean not null default false,
  notes text,
  cancelled boolean not null default false,
  is_campo_wide boolean not null default false,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or ends_at > starts_at),
  check (not is_campo_wide or church_id is null)
);
create index events_church_idx on public.events(church_id) where deleted_at is null;
create index events_starts_at_idx on public.events(starts_at) where deleted_at is null;
create index events_recurrence_idx on public.events(recurrence_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Validação de integridade
-- ---------------------------------------------------------------------------
create or replace function public.validate_event()
returns trigger
language plpgsql
as $$
begin
  if new.ends_at is not null and new.ends_at <= new.starts_at then
    raise exception 'A data de término do evento precisa ser depois do início.';
  end if;
  return new;
end;
$$;

create trigger validate_event before insert or update on public.events
  for each row execute function public.validate_event();

-- ---------------------------------------------------------------------------
-- GRANTs, RLS e policies
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.event_types to authenticated;
grant all on public.event_types to service_role;
alter table public.event_types enable row level security;

create policy "event_types_select" on public.event_types for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "event_types_write_admin" on public.event_types for all to authenticated
  using (is_active_user() and organization_id = current_org_id() and is_org_admin())
  with check (organization_id = current_org_id() and is_org_admin());

create trigger set_updated_at before update on public.event_types
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.event_recurrences to authenticated;
grant all on public.event_recurrences to service_role;
alter table public.event_recurrences enable row level security;

create policy "event_recurrences_select" on public.event_recurrences for select to authenticated
  using (is_active_user() and organization_id = current_org_id());
create policy "event_recurrences_write" on public.event_recurrences for all to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or (is_campo_wide and has_access_profile('church_leader')))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or (is_campo_wide and has_access_profile('church_leader')))
  );

create trigger set_updated_at before update on public.event_recurrences
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.event_recurrences
  for each row execute function public.write_audit();

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;

-- Leitura: eventos da própria igreja, de todo o campo, ou divulgados por
-- outra igreja (regra 6.4).
create policy "events_select" on public.events for select to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_campo_wide or is_shared or has_church_scope(church_id))
  );
create policy "events_write" on public.events for all to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or (is_campo_wide and has_access_profile('church_leader')))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or (is_campo_wide and has_access_profile('church_leader')))
  );

create trigger set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.events
  for each row execute function public.write_audit();
