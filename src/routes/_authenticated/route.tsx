import { Navigate, Outlet } from "react-router-dom";
import { LoadingState } from "@/components/DataState";
import { AppShell } from "@/app/AppShell";
import { useSession } from "@/hooks/useSession";

/**
 * Portão de autenticação. Sem usuário logado, redireciona para /auth. Todas
 * as telas do sistema vivem sob este portão.
 */
export function AuthenticatedRoute() {
  const { loading, user } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Verificando sessão…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
