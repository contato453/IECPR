// Edge Function (Deno) — ações administrativas de usuário.
//
// Só isto usa a service_role key. Todo pedido primeiro é validado com o
// cliente do PRÓPRIO usuário (token do header Authorization), checando
// `is_org_admin` via RPC — só então o handler carrega o client admin e
// chama `auth.admin.*`. Ver seção 5 da documentação de reconstrução.
//
// Deploy: supabase functions deploy admin-users
// Secrets necessários (supabase secrets set):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

// @ts-expect-error - resolvido em runtime Deno pelo Supabase, não pelo bundler do app
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado." }, 401);

    // Cliente com a sessão do usuário chamador — RLS se aplica normalmente.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Sessão inválida." }, 401);

    const { data: isAdmin, error: rpcError } = await callerClient.rpc("is_org_admin", { _user_id: user.id });
    if (rpcError) return jsonResponse({ error: rpcError.message }, 500);
    if (!isAdmin) return jsonResponse({ error: "Somente o pastor administrador pode executar esta ação." }, 403);

    const body = await req.json();
    const { action } = body;

    // Só a partir daqui carregamos o client privilegiado — nunca antes.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === "create_user") {
      const { email, password, full_name, person_id } = body;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, person_id: person_id ?? null },
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ id: data.user?.id ?? null });
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erro interno." }, 500);
  }
});
