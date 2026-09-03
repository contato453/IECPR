import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "As senhas não conferem.",
    path: ["confirmation"],
  });
type Values = z.infer<typeof schema>;

export function AlterarSenhaPage() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmation: "" } });

  async function handleSubmit(values: Values) {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModulePage title="Alterar senha" description="Troque a sua própria senha de acesso.">
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" className="mt-1.5" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmation">Confirme a nova senha</Label>
              <Input id="confirmation" type="password" className="mt-1.5" {...form.register("confirmation")} />
              {form.formState.errors.confirmation && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.confirmation.message}</p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="self-start">
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
