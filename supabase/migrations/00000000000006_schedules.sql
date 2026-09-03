-- IECPR — Migração 6: escalas, itens, versões e confirmações.
--
-- Decisões de produto que moldam este schema (ver seção 10 e Bugs #4/#5):
--   * NENHUMA trava de igreja — uma pessoa de uma congregação pode ser
--     escalada em outra. O antigo trigger tr_validate_schedule_item_church
--     nunca existe nesta reconstrução.
--   * NENHUM índice único de "uma função por evento" — a mesma pessoa pode
--     dirigir e pregar no mesmo culto.
--   * Qualquer pessoa cadastrada pode ocupar qualquer função, inclusive
--     pregar — sem filtro por qualificação.

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid not null references public.churches(id),
  title text not null,
  period_start date not null,
  period_end date not null,
  status public.workflow_status not null default 'draft',
  version integer not null default 1,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (church_id, period_start)
);
create index schedules_church_idx on public.schedules(church_id) where deleted_at is null;

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  event_id uuid references public.events(id),
  kind public.schedule_item_kind not null,
  person_id uuid references public.people(id),
  department_id uuid references public.departments(id),
  opportunity_label text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index schedule_items_schedule_idx on public.schedule_items(schedule_id);
create index schedule_items_event_idx on public.schedule_items(event_id);
create index schedule_items_person_idx on public.schedule_items(person_id);

create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  version integer not null,
  status public.workflow_status not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index schedule_versions_schedule_idx on public.schedule_versions(schedule_id);

create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  person_id uuid not null references public.people(id),
  church_id uuid not null references public.churches(id),
  status public.confirmation_status not null default 'pending',
  responded_at timestamptz,
  replacement_person_id uuid references public.people(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (schedule_item_id)
);
create index confirmations_church_idx on public.confirmations(church_id);
create index confirmations_person_idx on public.confirmations(person_id);

-- ---------------------------------------------------------------------------
-- Validação de item de escala — SEM trava de igreja (Bug #5 corrigido) e SEM
-- checagem de qualificação/acúmulo de função (Bug #4 corrigido).
-- ---------------------------------------------------------------------------
create or replace function public.validate_schedule_item()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'opportunity' and (new.opportunity_label is null or length(trim(new.opportunity_label)) = 0) then
    raise exception 'Informe o rótulo da oportunidade.';
  end if;
  return new;
end;
$$;

create trigger validate_schedule_item before insert or update on public.schedule_items
  for each row execute function public.validate_schedule_item();

-- Marca responded_at automaticamente quando o status deixa de ser 'pending'.
create or replace function public.touch_confirmation()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'pending' and (old.status is distinct from new.status) and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger touch_confirmation before update on public.confirmations
  for each row execute function public.touch_confirmation();

-- Reabre uma escala aprovada/publicada: grava snapshot da versão atual e
-- volta para rascunho com a versão incrementada.
create or replace function public.reopen_schedule(_schedule_id uuid)
returns public.schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.schedules;
  v_items jsonb;
begin
  select * into v_schedule from public.schedules where id = _schedule_id;
  if v_schedule.id is null then
    raise exception 'Escala não encontrada.';
  end if;
  if not (is_org_admin() or is_church_leader_of(v_schedule.church_id)) then
    raise exception 'Sem permissão para reabrir esta escala.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(si)), '[]'::jsonb) into v_items
  from public.schedule_items si where si.schedule_id = _schedule_id;

  insert into public.schedule_versions (schedule_id, version, status, snapshot, created_by)
  values (_schedule_id, v_schedule.version, v_schedule.status, v_items, auth.uid());

  update public.schedules
  set status = 'draft', version = v_schedule.version + 1
  where id = _schedule_id
  returning * into v_schedule;

  return v_schedule;
end;
$$;

-- Ao publicar, enfileira uma confirmação pendente por item com pessoa.
create or replace function public.queue_schedule_confirmations(_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.confirmations (schedule_item_id, person_id, church_id, status)
  select si.id, si.person_id, s.church_id, 'pending'
  from public.schedule_items si
  join public.schedules s on s.id = si.schedule_id
  where si.schedule_id = _schedule_id
    and si.person_id is not null
  on conflict (schedule_item_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- GRANTs, RLS e policies
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.schedules to authenticated;
grant all on public.schedules to service_role;
alter table public.schedules enable row level security;

create policy "schedules_select" on public.schedules for select to authenticated
  using (is_active_user() and organization_id = current_org_id() and has_church_scope(church_id));
create policy "schedules_write" on public.schedules for all to authenticated
  using (
    is_active_user() and organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id))
  )
  with check (
    organization_id = current_org_id()
    and (is_org_admin() or is_church_leader_of(church_id))
  );

create trigger set_updated_at before update on public.schedules
  for each row execute function public.set_updated_at();
create trigger write_audit after insert or update or delete on public.schedules
  for each row execute function public.write_audit();

grant select, insert, update, delete on public.schedule_items to authenticated;
grant all on public.schedule_items to service_role;
alter table public.schedule_items enable row level security;

create policy "schedule_items_select" on public.schedule_items for select to authenticated
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and is_active_user() and s.organization_id = current_org_id() and has_church_scope(s.church_id)
    )
  );
create policy "schedule_items_write" on public.schedule_items for all to authenticated
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and is_active_user() and s.organization_id = current_org_id()
        and (is_org_admin() or is_church_leader_of(s.church_id) or is_department_leader_of(department_id))
    )
  );

grant select on public.schedule_versions to authenticated;
grant all on public.schedule_versions to service_role;
alter table public.schedule_versions enable row level security;

create policy "schedule_versions_select" on public.schedule_versions for select to authenticated
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_id and is_active_user() and s.organization_id = current_org_id() and has_church_scope(s.church_id)
    )
  );

grant select, insert, update on public.confirmations to authenticated;
grant all on public.confirmations to service_role;
alter table public.confirmations enable row level security;

create policy "confirmations_select" on public.confirmations for select to authenticated
  using (is_active_user() and has_church_scope(church_id));
-- Responder uma confirmação é permitido a quem lidera a igreja/departamento
-- OU à própria pessoa escalada (comparando com profiles.person_id do
-- usuário logado) — nunca a qualquer usuário com mero acesso de leitura à
-- igreja, senão um ministerial_viewer poderia confirmar/recusar em nome de
-- outra pessoa.
create policy "confirmations_update" on public.confirmations for update to authenticated
  using (
    is_active_user()
    and (
      is_org_admin()
      or is_church_leader_of(church_id)
      or person_id = (select p.person_id from public.profiles p where p.id = auth.uid())
    )
  );
create policy "confirmations_insert_admin" on public.confirmations for insert to authenticated
  with check (is_active_user() and (is_org_admin() or is_church_leader_of(church_id)));
