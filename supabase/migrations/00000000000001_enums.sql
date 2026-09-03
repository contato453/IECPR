-- IECPR — Migração 1: enums do schema public.
-- Convenção do projeto: nomes técnicos em inglês; tradução para pt-BR fica
-- inteiramente em src/lib/labels.ts, nunca no banco.

create type public.access_profile as enum (
  'pastor_admin',
  'church_leader',
  'department_leader',
  'ministerial_viewer'
);

create type public.ministerial_qualification as enum (
  'pastor_president',
  'assistant_pastor',
  'pastor',
  'evangelist',
  'presbyter',
  'deacon',
  'missionary',
  'cooperator',
  'sunday_school_teacher',
  'member'
);

create type public.workflow_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'returned',
  'rejected',
  'published',
  'cancelled'
);

create type public.schedule_item_kind as enum ('leader', 'preacher', 'opportunity');
create type public.confirmation_status as enum ('pending', 'confirmed', 'declined', 'replaced');
create type public.recurrence_frequency as enum ('weekly', 'biweekly', 'monthly');
create type public.notification_channel as enum ('whatsapp', 'email', 'manual');
create type public.notification_status as enum ('queued', 'sending', 'sent', 'failed', 'cancelled');
