import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/DataState";
import { useSession } from "@/hooks/useSession";

export function ConfiguracoesPage() {
  const { isAdmin, profile } = useSession();

  if (!isAdmin) {
    return (
      <ModulePage title="Configurações">
        <EmptyState title="Acesso restrito" description="Somente o pastor administrador vê esta tela." />
      </ModulePage>
    );
  }

  return (
    <ModulePage title="Configurações" description="Dados gerais da organização.">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Organização</CardTitle>
          <CardDescription>Uma organização representa o campo inteiro (IECPR).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fuso horário</p>
            <p className="font-medium">America/Sao_Paulo</p>
          </div>
          <div>
            <p className="text-muted-foreground">Organização</p>
            <p className="font-medium">{profile?.organization_id ? "IECPR" : "—"}</p>
          </div>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
