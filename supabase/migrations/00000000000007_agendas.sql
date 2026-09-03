-- IECPR — Migração 7: agendas departamentais.
-- Semana de domingo a sábado; prazo padrão = sábado anterior, 18h, no fuso
-- da organização (regra 6.7). Calculado por trigger no banco e espelhado no
-- cliente por `defaultDeadline()` (src/features/agendas/api.ts) — em caso de
-- divergência, o banco vence.

create table public.department_agendas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid not null references public.churches(id),
  department_id uuid not null references public.departments(id),
  title text not null,
  week_start date not null,
  week_end date,
  deadline_at timestamptz,
  status public.workflow_status not null default 'draft',
  version integer not null default 1,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (department_id, week_start)
);
create index department_agendas_church_idx on public.department_agendas(church_id) where deleted_at is null;

create table public.department_agenda_items (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.department_agendas(id) on delete cascade,
  title text not null,
  description text,
  item_date date not null,
  start_time time,
  responsible_person_id uuid references public.people(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index department_agenda_items_agenda_idx on public.department_agenda_items(agenda_id);

-- ---------------------------------------------------------------------------
-- week_end e deadline_at por trigger (sábado anterior, 18h, fuso da org)
-- ---------------------------------------------------------------------------
create or replace function public.set_agenda_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_saturday date;
begin
  select timezone into v_tz from public.organizations where id = new.organization_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');

  if new.week_end is null then
    new.week_end := new.week_start + 6;
  end if;

  if new.deadline_at is null then
    v_saturday := new.week_start - 1; -- sábado anterior
    new.deadline_at := (v_saturday::text || ' 18:00')::timestamp at time zone v_tz;
  end if;

  return new;
end;
$$;

create trigger set_agenda_defaults before insert on public.department_agendas
  for each row execute function public.set_agenda_defaults();

create or replace function public.validate_agenda_item()
returns trigger
language plpgsql
as $$
declare
  v_week_start date;
  v_week_end date;
begin
  select week_start, week_end into v_week_start, v_week_end
  from public.department_agendas where id = new.agenda_id;

  if v_week_end is not null and (new.item_date < v_week_start or new.item_date > v_week_end) then
    raise exception 'A data do item precisa estar dentro da semana da agenda.';
  end if;
  return new;
end;
$$;

create trigger validate_agenda_item before insert or update on public.department_agenda_items
  for each row execute function public.validate_agenda_item();

-- ---------------------------------------------------------------------------
-- GRANTs, RLS e policies
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.department_agendas to authenticated;
grant all on public.department_agendas to service_role;
alter table public.department_agendas enable row level security;

create policy "department_agendas_select" on public.department_agendas for select to authenticated
  using (is_active_user() and organization_id = current_org_id() and has_church_scope(church_id));
create policy "department_agendas_write" on public.department_agendas for all to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or is_department_leader_of(department_id))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id) or is_department_leader_of(department_id))
  );

create trigger set_updated_at before update on public.department_agendas
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.department_agendas
  for each row execute function public.write_audit();

grant select, insert, update, delete on public.department_agenda_items to authenticated;
grant all on public.department_agenda_items to service_role;
alter table public.department_agenda_items enable row level security;

create policy "department_agenda_items_select" on public.department_agenda_items for select to authenticated
  using (
    exists (
      select 1 from public.department_agendas a
      where a.id = agenda_id and is_active_user() and a.organization_id = current_org_id() and has_church_scope(a.church_id)
    )
  );
create policy "department_agenda_items_write" on public.department_agenda_items for all to authenticated
  using (
    exists (
      select 1 from public.department_agendas a
      where a.id = agenda_id and is_active_user() and a.organization_id = current_org_id()
        and (is_org_admin() or is_church_leader_of(a.church_id) or is_department_leader_of(a.department_id))
    )
  );
