import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudTable } from "@/components/CrudTable";
import { listChurches } from "@/features/core/api";
import { listConfirmationsDetailed, respondConfirmation } from "@/features/schedules/api";
import { confirmationStatusLabels, scheduleItemKindLabels } from "@/lib/labels";
import { formatDateBR, formatTimeBR } from "@/lib/date";

const statusVariant = {
  pending: "outline",
  confirmed: "success",
  declined: "destructive",
  replaced: "warning",
} as const;

export function ConfirmacoesPage() {
  const queryClient = useQueryClient();
  const [churchId, setChurchId] = useState<string>("all");
  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: confirmations, isLoading } = useQuery({
    queryKey: ["confirmations", churchId],
    queryFn: () => listConfirmationsDetailed(churchId === "all" ? undefined : churchId),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "declined" }) => respondConfirmation(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["confirmations"] });
      toast.success("Confirmação atualizada.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar."),
  });

  return (
    <ModulePage title="Confirmações" description="Respostas dos escalados a cada designação.">
      <div className="mb-4 max-w-xs">
        <Select value={churchId} onValueChange={setChurchId}>
          <SelectTrigger>
            <SelectValue placeholder="Igreja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as igrejas</SelectItem>
            {churches.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.short_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CrudTable
        rows={confirmations}
        isLoading={isLoading}
        rowKey={(c) => c.id}
        emptyTitle="Nenhuma confirmação pendente"
        columns={[
          { header: "Pessoa", cell: (c) => c.people?.full_name ?? "—" },
          { header: "Função", cell: (c) => (c.schedule_items ? scheduleItemKindLabels[c.schedule_items.kind] : "—") },
          {
            header: "Evento",
            cell: (c) =>
              c.schedule_items?.events
                ? `${c.schedule_items.events.title} · ${formatDateBR(c.schedule_items.events.starts_at)} ${formatTimeBR(c.schedule_items.events.starts_at)}`
                : "—",
          },
          {
            header: "Status",
            cell: (c) => <Badge variant={statusVariant[c.status]}>{confirmationStatusLabels[c.status]}</Badge>,
          },
        ]}
        extraActions={(c) =>
          c.status === "pending" ? (
            <>
              <Button variant="ghost" size="icon" title="Confirmar" onClick={() => respondMutation.mutate({ id: c.id, status: "confirmed" })}>
                <Check className="size-4 text-success" />
              </Button>
              <Button variant="ghost" size="icon" title="Recusar" onClick={() => respondMutation.mutate({ id: c.id, status: "declined" })}>
                <X className="size-4 text-destructive" />
              </Button>
            </>
          ) : null
        }
      />
    </ModulePage>
  );
}
