import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/**
 * Ações administrativas que exigem a `service_role key` do Supabase — por
 * isso nunca rodam no navegador. Aqui elas viram chamadas para a Edge
 * Function `admin-users` (ver supabase/functions/admin-users/index.ts), que
 * confere `is_org_admin` usando o token do próprio usuário ANTES de tocar
 * em qualquer API administrativa.
 */

export const createUserSchema = z.object({
  full_name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  person_id: z.string().uuid().nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updatePasswordSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

async function invokeAdmin<TResult>(action: string, payload: Record<string, unknown>): Promise<TResult> {
  const { data, error } = await supabase.functions.invoke<TResult>("admin-users", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  return data as TResult;
}

export async function createUserAccount(input: CreateUserInput): Promise<{ id: string }> {
  const data = createUserSchema.parse(input);
  return invokeAdmin("create_user", data);
}

export async function updateUserPassword(input: UpdatePasswordInput): Promise<{ ok: true }> {
  const data = updatePasswordSchema.parse(input);
  return invokeAdmin("update_password", data);
}
