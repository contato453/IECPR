-- IECPR — Migração 10: GRANT EXECUTE explícito nas funções chamadas
-- diretamente pelo cliente via `db.rpc(...)` ou pela Edge Function
-- admin-users. Postgres libera EXECUTE para PUBLIC por padrão em funções
-- novas, mas deixamos explícito para não depender desse comportamento.

grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_access_profile(public.access_profile) to authenticated;
grant execute on function public.is_church_leader_of(uuid) to authenticated;
grant execute on function public.has_church_scope(uuid) to authenticated;
grant execute on function public.has_department_scope(uuid) to authenticated;
grant execute on function public.is_department_leader_of(uuid) to authenticated;
grant execute on function public.can_read_person(uuid) to authenticated;
grant execute on function public.reopen_schedule(uuid) to authenticated;
grant execute on function public.queue_schedule_confirmations(uuid) to authenticated;
