import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    "Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não configuradas. Copie .env.example para .env e preencha.",
  );
}

/**
 * Cliente Supabase do navegador. Usa a chave pública (publishable/anon) —
 * toda proteção de dados vem da Row Level Security no banco, nunca deste
 * cliente. Nunca importar a service_role key aqui.
 */
// createClient valida a URL de forma síncrona e lança exceção se ela não for
// uma URL válida — por isso o placeholder abaixo quando a variável não está
// configurada (ex.: em testes unitários, que não chegam a fazer requisições
// de rede). O aviso no console acima é o que importa em desenvolvimento real.
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabasePublishableKey || "placeholder-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
