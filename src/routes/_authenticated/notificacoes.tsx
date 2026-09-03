import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudTable } from "@/components/CrudTable";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import {
  createNotificationTemplate,
  dispatchMockJob,
  listNotificationJobs,
  listNotificationTemplates,
  updateNotificationTemplate,
} from "@/features/notifications/api";
import { useSession } from "@/hooks/useSession";
import { notificationChannelLabels, notificationStatusLabels } from "@/lib/labels";
import { formatDateBR, formatTimeBR } from "@/lib/date";
import type { NotificationTemplate } from "@/types/domain";

const templateSchema = z.object({
  name: z.string().min(2, "Informe o nome do template."),
  channel: z.enum(["whatsapp", "email", "manual"]),
  body: z.string().min(5, "Informe o corpo da mensagem."),
});
type TemplateValues = z.infer<typeof templateSchema>;

const jobStatusVariant = {
  queued: "outline",
  sending: "warning",
  sent: "success",
  failed: "destructive",
  cancelled: "outline",
} as const;

export function NotificacoesPage() {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);

  const { data: templates, isLoading: loadingTemplates } = useQuery({ queryKey: ["notification-templates"], queryFn: listNotificationTemplates });
  const { data: jobs, isLoading: loadingJobs } = useQuery({ queryKey: ["notification-jobs"], queryFn: () => listNotificationJobs() });

  const fields: RecordField<TemplateValues>[] = [
    { name: "name", label: "Nome", type: "text", colSpan: 2 },
    {
      name: "channel",
      label: "Canal",
      type: "select",
      options: Object.entries(notificationChannelLabels).map(([value, label]) => ({ value, label })),
    },
    { name: "body", label: "Mensagem", type: "textarea", colSpan: 2, description: "Use {{nome}}, {{funcao}}, {{data}}, {{hora}}, {{igreja}}." },
  ];

  const saveMutation = useMutation({
    mutationFn: (values: TemplateValues) => {
      if (editing) return updateNotificationTemplate(editing.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createNotificationTemplate({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast.success("Template salvo.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => dispatchMockJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-jobs"] });
      toast.success("Envio simulado com sucesso (modo mock).");
    },
  });

  return (
    <ModulePage title="Notificações" description="Templates e fila de envios (WhatsApp em modo mock).">
      <Tabs defaultValue="fila">
        <TabsList>
          <TabsTrigger value="fila">Fila de envios</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="fila">
          <CrudTable
            rows={jobs}
            isLoading={loadingJobs}
            rowKey={(j) => j.id}
            emptyTitle="Nenhum envio na fila"
            extraActions={(j) =>
              j.status === "queued" ? (
                <Button variant="ghost" size="sm" onClick={() => dispatchMutation.mutate(j.id)}>
                  <Send className="size-4" /> Enviar (mock)
                </Button>
              ) : null
            }
            columns={[
              { header: "Destino", cell: (j) => j.destination },
              { header: "Canal", cell: (j) => notificationChannelLabels[j.channel] },
              { header: "Mensagem", cell: (j) => <span className="line-clamp-1 max-w-xs">{j.message}</span> },
              { header: "Status", cell: (j) => <Badge variant={jobStatusVariant[j.status]}>{notificationStatusLabels[j.status]}</Badge> },
              { header: "Criado em", cell: (j) => `${formatDateBR(j.created_at)} ${formatTimeBR(j.created_at)}` },
            ]}
          />
        </TabsContent>

        <TabsContent value="templates">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus /> Novo template
            </Button>
          </div>
          <CrudTable
            rows={templates}
            isLoading={loadingTemplates}
            rowKey={(t) => t.id}
            emptyTitle="Nenhum template cadastrado"
            onEdit={(t) => { setEditing(t); setDialogOpen(true); }}
            columns={[
              { header: "Nome", cell: (t) => t.name },
              { header: "Canal", cell: (t) => notificationChannelLabels[t.channel] },
              { header: "Mensagem", cell: (t) => <span className="line-clamp-1 max-w-md">{t.body}</span> },
            ]}
          />
        </TabsContent>
      </Tabs>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar template" : "Novo template"}
        schema={templateSchema}
        fields={fields}
        defaultValues={{
          name: editing?.name ?? "",
          channel: editing?.channel ?? "whatsapp",
          body: editing?.body ?? "",
        }}
        onSubmit={(v) => saveMutation.mutateAsync(v)}
      />
    </ModulePage>
  );
}
