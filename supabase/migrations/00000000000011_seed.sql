-- IECPR — Migração 11: seed mínimo de demonstração.
-- Dados de teste devem SEMPRE entrar por migração de seed identificável e
-- removível (ver Bug #10 da documentação) — nunca inseridos manualmente em
-- produção. Nenhum dado real de membro/e-mail/senha entra aqui.

insert into public.organizations (id, name, slug, timezone, active)
values ('00000000-0000-0000-0000-000000000001', 'IECPR', 'iecpr', 'America/Sao_Paulo', true)
on conflict (id) do nothing;

insert into public.churches (id, organization_id, name, short_name, city, is_headquarters, active)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Igreja Evangélica Congregacional do Porto do Rosa', 'Matriz', 'Porto do Rosa', true, true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Congregação de Outeiro das Pedras', 'Outeiro das Pedras', 'Outeiro das Pedras', false, true)
on conflict (id) do nothing;

-- Departamentos padrão (regra 6.10): toda igreja tem, no mínimo, DEPIN,
-- Homens, Jovens e Mulheres.
insert into public.departments (organization_id, church_id, name)
select '00000000-0000-0000-0000-000000000001', c.id, d.name
from public.churches c
cross join (values ('DEPIN'), ('Homens'), ('Jovens'), ('Mulheres')) as d(name)
where c.organization_id = '00000000-0000-0000-0000-000000000001'
on conflict do nothing;

insert into public.event_types (organization_id, name, allows_lords_supper, default_duration_minutes)
values
  ('00000000-0000-0000-0000-000000000001', 'Culto de Celebração', true, 90),
  ('00000000-0000-0000-0000-000000000001', 'Culto de Oração', false, 60),
  ('00000000-0000-0000-0000-000000000001', 'Escola Bíblica Dominical', false, 60),
  ('00000000-0000-0000-0000-000000000001', 'Reunião Departamental', false, 90)
on conflict do nothing;

insert into public.ministerial_roles (organization_id, name)
values
  ('00000000-0000-0000-0000-000000000001', 'Corpo Pastoral'),
  ('00000000-0000-0000-0000-000000000001', 'Conselho de Presbíteros'),
  ('00000000-0000-0000-0000-000000000001', 'Diaconato')
on conflict do nothing;

insert into public.notification_templates (organization_id, name, channel, body)
values (
  '00000000-0000-0000-0000-000000000001',
  'Confirmação de escala (WhatsApp)',
  'whatsapp',
  'Olá {{nome}}! Você foi escalado(a) como {{funcao}} no culto de {{data}} às {{hora}} ({{igreja}}). Pode confirmar presença?'
)
on conflict do nothing;

-- Nenhum usuário é criado aqui — contas nascem via auth.admin.createUser
-- (Edge Function admin-users), nunca por INSERT direto em auth.users.
