import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/assets/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { recordLastLogin } from "@/lib/auth.functions";
import { useSession } from "@/hooks/useSession";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Login por e-mail e senha. Sem cadastro público, sem login social — contas
 * são criadas pelo administrador (ver /usuarios).
 */
export function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) {
    return <Navigate to="/painel" replace />;
  }

  async function handleSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(values);
      if (error) throw error;
      if (data.user) await recordLastLogin(data.user.id);
      navigate("/painel", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="size-20" />
          <div>
            <h1 className="font-serif text-xl font-semibold">IECPR</h1>
            <p className="text-sm text-muted-foreground">Sistema de gestão ministerial</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-8 flex flex-col gap-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="username" className="mt-1.5" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" className="mt-1.5" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="mt-2" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
