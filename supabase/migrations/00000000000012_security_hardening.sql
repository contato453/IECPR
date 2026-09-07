-- IECPR — Migração 12: fecha os avisos do advisor de segurança do Supabase.
--
-- 1) search_path mutável em funções de trigger — proteção contra sequestro
--    de search_path (uma função sem search_path fixo pode ser enganada por
--    um objeto de mesmo nome criado em outro schema à frente na busca).
-- 2) EXECUTE das funções RPC restrito a `authenticated` — revoga de PUBLIC
--    (que inclui `anon`). Essas funções já eram seguras na prática (todas
--    dependem de auth.uid(), que é nulo para quem não está logado), mas não
--    custa fechar a superfície exposta via /rest/v1/rpc/*.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ends_at is not null and new.ends_at <= new.starts_at then
    raise exception 'A data de término do evento precisa ser depois do início.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_schedule_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'opportunity' and (new.opportunity_label is null or length(trim(new.opportunity_label)) = 0) then
    raise exception 'Informe o rótulo da oportunidade.';
  end if;
  return new;
end;
$$;

create or replace function public.touch_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'pending' and (old.status is distinct from new.status) and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.validate_agenda_item()
returns trigger
language plpgsql
set search_path = public
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

revoke execute on function public.current_org_id() from public;
revoke execute on function public.is_active_user() from public;
revoke execute on function public.has_access_profile(public.access_profile) from public;
revoke execute on function public.is_org_admin(uuid) from public;
revoke execute on function public.is_church_leader_of(uuid) from public;
revoke execute on function public.has_church_scope(uuid) from public;
revoke execute on function public.has_department_scope(uuid) from public;
revoke execute on function public.is_department_leader_of(uuid) from public;
revoke execute on function public.can_read_person(uuid) from public;
revoke execute on function public.reopen_schedule(uuid) from public;
revoke execute on function public.queue_schedule_confirmations(uuid) from public;
revoke execute on function public.sync_person_qualifications(uuid, public.ministerial_qualification[]) from public;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_access_profile(public.access_profile) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_church_leader_of(uuid) to authenticated;
grant execute on function public.has_church_scope(uuid) to authenticated;
grant execute on function public.has_department_scope(uuid) to authenticated;
grant execute on function public.is_department_leader_of(uuid) to authenticated;
grant execute on function public.can_read_person(uuid) to authenticated;
grant execute on function public.reopen_schedule(uuid) to authenticated;
grant execute on function public.queue_schedule_confirmations(uuid) to authenticated;
grant execute on function public.sync_person_qualifications(uuid, public.ministerial_qualification[]) to authenticated;
