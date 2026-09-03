-- IECPR — Migração 9: RPC que substitui o conjunto de qualificações
-- ministeriais de uma pessoa por completo (usada pela tela /pessoas).

create or replace function public.sync_person_qualifications(_person_id uuid, _qualifications public.ministerial_qualification[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
begin
  select church_id into v_church_id from public.people where id = _person_id;

  if not (is_org_admin() or is_church_leader_of(v_church_id)) then
    raise exception 'Sem permissão para alterar as qualificações desta pessoa.';
  end if;

  delete from public.person_qualifications
  where person_id = _person_id
    and qualification <> all (coalesce(_qualifications, array[]::public.ministerial_qualification[]));

  insert into public.person_qualifications (person_id, qualification)
  select _person_id, q
  from unnest(coalesce(_qualifications, array[]::public.ministerial_qualification[])) as q
  on conflict (person_id, qualification) do nothing;
end;
$$;

grant execute on function public.sync_person_qualifications(uuid, public.ministerial_qualification[]) to authenticated;
