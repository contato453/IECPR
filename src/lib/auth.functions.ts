import { supabase } from "@/integrations/supabase/client";

/** Grava `profiles.last_login` — chamado logo após um login bem-sucedido. */
export async function recordLastLogin(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", userId);
  if (error) {
    console.error("Falha ao registrar último login:", error.message);
  }
}
