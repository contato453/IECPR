import { supabase } from "@/integrations/supabase/client";

export { supabase };

/**
 * `db` é o mesmo cliente Supabase do navegador, reexportado com o nome curto
 * usado por toda a camada `features/*\/api.ts`. A tipagem das tabelas é
 * deliberadamente aberta (ver integrations/supabase/types.ts) — o contrato
 * de dados "de verdade" é o de `src/types/domain.ts`, aplicado no retorno de
 * cada função de API via `unwrap<T>()`.
 */
export const db = supabase;

export interface PostgrestLikeResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Transforma o `{ data, error }` do PostgREST em valor ou exceção legível. */
export function unwrap<T>(result: PostgrestLikeResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
