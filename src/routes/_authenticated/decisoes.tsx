import { Scale } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { EmptyState } from "@/components/DataState";

/**
 * Decisão e Reconciliação — item de menu existe a pedido explícito da
 * liderança, mas a página em si nunca foi implementada (ver "Pontos em
 * aberto" da documentação de reconstrução). Mantido como placeholder
 * deliberado, não como pendência esquecida.
 */
export function DecisoesPage() {
  return (
    <ModulePage title="Decisão e Reconciliação">
      <EmptyState
        title="Em construção"
        description="Esta tela ainda não foi implementada. O card “Decisões nos últimos 30 dias” do painel continua com valor fixo até que ela exista."
      />
      <div className="mt-4 flex justify-center text-muted-foreground">
        <Scale className="size-8" />
      </div>
    </ModulePage>
  );
}
