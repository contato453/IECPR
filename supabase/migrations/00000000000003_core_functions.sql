-- IECPR — Migração 3: funções SECURITY DEFINER de escopo/segurança e
-- triggers genéricos. Toda função aqui roda com o dono da migração
-- (bypassa RLS) para poder ler user_access_profiles/profiles sem recursão —
-- é exatamente o padrão que evita "policy que consulta a própria tabela
-- protegida por essa policy".

-- ---------------------------------------------------------------------------
-- Organização e status do usuário logado
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Perfis de acesso (independentes da qualificação ministerial)
-- ---------------------------------------------------------------------------

create or replace function public.has_access_profile(_profile public.access_profile)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_access_profiles
    where user_id = auth.uid() and profile = _profile
  );
$$;

create or replace function public.is_org_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_access_profiles
    where user_id = _user_id and profile = 'pastor_admin'
  );
$$;

-- Líder (de igreja ou departamento) com escopo em toda a organização quando
-- church_id/department_id da linha de acesso é nulo.
create or replace function public.is_church_leader_of(_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_access_profiles
    where user_id = auth.uid()
      and profile = 'church_leader'
      and (church_id is null or church_id = _church_id)
  );
$$;

-- ATENÇÃO: has_church_scope / has_department_scope respondem "esse usuário
-- tem QUALQUER perfil de acesso com escopo nessa igreja/departamento" — sem
-- olhar qual perfil é. Isso é exatamente o que se quer para LEITURA (um
-- ministerial_viewer também precisa enxergar os dados da própria igreja),
-- mas é PERIGOSO para ESCRITA: usado sem cuidado, deixaria um
-- ministerial_viewer escrever como se fosse church_leader. Toda policy de
-- escrita (insert/update/delete) deve usar is_church_leader_of /
-- is_department_leader_of, que filtram pelo perfil correto, nunca estas
-- duas funções.
create or replace function public.has_church_scope(_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin(auth.uid()) or exists (
    select 1 from public.user_access_profiles
    where user_id = auth.uid()
      and (church_id is null or church_id = _church_id)
  );
$$;

create or replace function public.has_department_scope(_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin(auth.uid()) or exists (
    select 1 from public.user_access_profiles
    where user_id = auth.uid()
      and (department_id is null or department_id = _department_id)
  );
$$;

-- Estas duas, ao contrário das acima, filtram pelo perfil certo — são as
-- que toda policy de ESCRITA deve usar.
create or replace function public.is_department_leader_of(_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_access_profiles
    where user_id = auth.uid()
      and profile = 'department_leader'
      and (department_id is null or department_id = _department_id)
  );
$$;

-- Leitura de pessoa conforme escopo: admin lê tudo; líder de igreja lê quem
-- é da(s) igreja(s) do seu escopo (ou de todas, se escopo nulo); acesso
-- ministerial lê o que está publicado na própria igreja.
create or replace function public.can_read_person(_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin(auth.uid()) or exists (
    select 1
    from public.people p
    where p.id = _person_id
      and (
        public.has_church_scope(p.church_id)
        or exists (
          select 1 from public.user_access_profiles uap
          where uap.user_id = auth.uid() and uap.profile = 'ministerial_viewer'
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers genéricos
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_action text;
  v_entity_id uuid;
  v_changes jsonb;
begin
  v_action := lower(tg_op);
  if tg_op = 'DELETE' then
    v_org := old.organization_id;
    v_entity_id := old.id;
    v_changes := to_jsonb(old);
  else
    v_org := new.organization_id;
    v_entity_id := new.id;
    v_changes := to_jsonb(new);
  end if;

  insert into public.audit_log (organization_id, actor_user_id, entity, entity_id, action, changes)
  values (v_org, auth.uid(), tg_table_name, v_entity_id, v_action, v_changes);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Cria a linha de `profiles` assim que um usuário é criado em auth.users
-- (via convite/criação administrativa). organization_id e full_name vêm de
-- user_metadata, definidos pela Edge Function admin-users no createUser.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations order by created_at limit 1;

  insert into public.profiles (id, organization_id, person_id, full_name, email, active)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'organization_id')::uuid, v_org_id),
    nullif(new.raw_user_meta_data->>'person_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
