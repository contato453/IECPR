import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudTable } from "@/components/CrudTable";
import { listChurches } from "@/features/core/api";
import { listSchedules } from "@/features/schedules/api";
import { formatDateBR } from "@/lib/date";
import { workflowStatusLabels } from "@/lib/labels";

const statusVariant: Record<string, "success" | "secondary" | "warning" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  under_review: "warning",
  approved: "success",
  returned: "warning",
  rejected: "destructive",
  published: "success",
  cancelled: "destructive",
};

/** Controle de Escalas — interface por abas, uma aba por igreja. As escalas já aparecem prontas. */
export function EscalasIndexPage() {
  const navigate = useNavigate();
  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const [activeChurch, setActiveChurch] = useState<string>("");

  const currentChurch = activeChurch || churches[0]?.id || "";

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules", currentChurch],
    queryFn: () => listSchedules(currentChurch),
    enabled: !!currentChurch,
  });

  return (
    <ModulePage title="Controle de Escalas" description="Escalas mensais por igreja — criadas automaticamente a partir da Agenda Geral.">
      {churches.length > 0 && (
        <Tabs value={currentChurch} onValueChange={setActiveChurch}>
          <TabsList>
            {churches.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.short_name}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={currentChurch}>
            <CrudTable
              rows={schedules}
              isLoading={isLoading}
              rowKey={(s) => s.id}
              emptyTitle="Nenhuma escala neste campo ainda"
              emptyDescription='Vá até "Agenda geral" e clique em "Atribuir escala" em um culto para começar.'
              columns={[
                { header: "Título", cell: (s) => s.title },
                { header: "Período", cell: (s) => `${formatDateBR(s.period_start)} a ${formatDateBR(s.period_end)}` },
                {
                  header: "Status",
                  cell: (s) => <Badge variant={statusVariant[s.status] ?? "outline"}>{workflowStatusLabels[s.status]}</Badge>,
                },
              ]}
              extraActions={(s) => (
                <button className="text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={() => navigate(`/escalas/${s.id}`)}>
                  Abrir
                </button>
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </ModulePage>
  );
}
