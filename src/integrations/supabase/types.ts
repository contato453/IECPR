/**
 * Tipos gerados pelo Supabase (`supabase gen types typescript`).
 *
 * Este projeto ainda não está conectado a um projeto Supabase real, então
 * este arquivo é um placeholder deliberadamente aberto — assim que o banco
 * existir, rode:
 *
 *   npx supabase gen types typescript --project-id SEU_PROJETO > src/integrations/supabase/types.ts
 *
 * Os tipos de domínio "de verdade", usados pela camada `features/*\/api.ts`,
 * vivem em `src/types/domain.ts` e não dependem deste arquivo.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
  };
}
