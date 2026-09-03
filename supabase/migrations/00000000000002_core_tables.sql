-- IECPR — Migração 2: tabelas núcleo (organizations, churches, departments,
-- people, profiles, ministerial_roles, person_qualifications, person_roles,
-- user_access_profiles, settings, audit_log).
--
-- Convenções aplicadas a toda tabela de negócio (ver seção 4 da doc):
--   id uuid pk default gen_random_uuid()
--   organization_id uuid not null            (isolamento multi-tenant)
--   created_at/updated_at timestamptz default now()
--   deleted_at timestamptz                   (exclusão lógica)
--
-- RLS, GRANTs e triggers ficam nas migrações seguintes — funções
-- SECURITY DEFINER (current_org_id etc.) ainda não existem neste ponto.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  short_name text not null,
  city text,
  is_headquarters boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index churches_org_idx on public.churches(organization_id) where deleted_at is null;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid references public.churches(id), -- nulo = departamento do campo
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index departments_org_idx on public.departments(organization_id) where deleted_at is null;
create index departments_church_idx on public.departments(church_id) where deleted_at is null;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  church_id uuid references public.churches(id),
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  situation text not null default 'ativo'
    check (situation in ('ativo', 'desligado', 'excluído', 'falecido', 'transferido')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create extension if not exists pg_trgm;
create index people_org_idx on public.people(organization_id) where deleted_at is null;
create index people_church_idx on public.people(church_id) where deleted_at is null;
create index people_name_idx on public.people using gin (full_name gin_trgm_ops);

-- profiles.id = auth.users.id — 1:1 com a conta de autenticação.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  person_id uuid references public.people(id),
  full_name text not null,
  email text not null,
  active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles(organization_id);

create table public.ministerial_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.person_qualifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  qualification public.ministerial_qualification not null,
  granted_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (person_id, qualification)
);
create index person_qualifications_person_idx on public.person_qualifications(person_id);

-- Vínculo puro pessoa <-> cargo ministerial customizado da organização.
create table public.person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  ministerial_role_id uuid not null references public.ministerial_roles(id) on delete cascade,
  unique (person_id, ministerial_role_id)
);

-- Perfil de ACESSO — independente da qualificação ministerial (regra crítica
-- da doc: "ser Pastor no cadastro não concede permissão administrativa").
-- Nunca lido a partir de `profiles`; sempre desta tabela, via funções
-- SECURITY DEFINER, para não abrir escalada de privilégio.
create table public.user_access_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  profile public.access_profile not null,
  church_id uuid references public.churches(id),
  department_id uuid references public.departments(id),
  created_at timestamptz not null default now(),
  unique (user_id, profile, church_id, department_id)
);
create index user_access_profiles_user_idx on public.user_access_profiles(user_id);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

-- Append-only: só INSERT via trigger/função. Ninguém tem UPDATE/DELETE.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_user_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log(organization_id, created_at desc);
