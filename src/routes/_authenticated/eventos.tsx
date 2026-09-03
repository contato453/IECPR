import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudTable } from "@/components/CrudTable";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import { listChurches } from "@/features/core/api";
import {
  createEvent,
  createEventRecurrence,
  createEventType,
  deleteEvent,
  deleteEventRecurrence,
  deleteEventType,
  listEventRecurrences,
  listEventTypes,
  listOccurrences,
  occurrenceEndOfMonthRange,
  updateEvent,
  updateEventRecurrence,
  updateEventType,
} from "@/features/events/api";
import { useSession } from "@/hooks/useSession";
import { formatDateBR, formatTimeBR, todayDateOnly } from "@/lib/date";
import { recurrenceFrequencyLabels, weekdayLabels } from "@/lib/labels";
import type { EventRecurrence, EventRow, EventType } from "@/types/domain";

const eventTypeSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  allows_lords_supper: z.boolean().optional(),
  default_duration_minutes: z.coerce.number().min(15).max(600).optional(),
});
type EventTypeValues = z.infer<typeof eventTypeSchema>;

const recurrenceSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  event_type_id: z.string().uuid("Selecione o tipo de evento."),
  church_id: z.string().uuid().nullable().optional(),
  frequency: z.string(),
  weekday: z.coerce.number().min(0).max(6),
  start_time: z.string().min(4, "Informe a hora."),
  duration_minutes: z.coerce.number().min(15).max(600),
  is_campo_wide: z.boolean().optional(),
  is_shared: z.boolean().optional(),
  notes: z.string().optional(),
});
type RecurrenceValues = z.infer<typeof recurrenceSchema>;

const eventSchema = z.object({
  title: z.string().min(2, "Informe o título."),
  event_type_id: z.string().uuid("Selecione o tipo de evento."),
  church_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().min(10, "Informe data e hora."),
  notes: z.string().optional(),
});
type EventValues = z.infer<typeof eventSchema>;

export function EventosPage() {
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: eventTypes, isLoading: loadingTypes } = useQuery({ queryKey: ["event-types"], queryFn: listEventTypes });
  const { data: recurrences, isLoading: loadingRecurrences } = useQuery({
    queryKey: ["event-recurrences"],
    queryFn: () => listEventRecurrences(),
  });

  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    return occurrenceEndOfMonthRange(now.getFullYear(), now.getMonth() + 1);
  }, []);
  const { data: occurrences, isLoading: loadingEvents } = useQuery({
    queryKey: ["occurrences", "eventos-page", periodStart, periodEnd],
    queryFn: () => listOccurrences(periodStart, periodEnd),
  });

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));
  const eventTypeNameById = new Map((eventTypes ?? []).map((t) => [t.id, t.name]));

  // Tipos de evento -----------------------------------------------------
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventType | null>(null);

  const typeFields: RecordField<EventTypeValues>[] = [
    { name: "name", label: "Nome", type: "text", colSpan: 2 },
    { name: "default_duration_minutes", label: "Duração padrão (min)", type: "number" },
    { name: "allows_lords_supper", label: "Permite Santa Ceia", type: "checkbox" },
  ];

  const typeMutation = useMutation({
    mutationFn: (values: EventTypeValues) => {
      if (editingType) return updateEventType(editingType.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createEventType({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success("Tipo de evento salvo.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  // Recorrências ----------------------------------------------------------
  const [recDialogOpen, setRecDialogOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<EventRecurrence | null>(null);

  const recFields: RecordField<RecurrenceValues>[] = [
    { name: "name", label: "Nome", type: "text", colSpan: 2 },
    { name: "event_type_id", label: "Tipo de evento", type: "select", options: () => (eventTypes ?? []).map((t) => ({ value: t.id, label: t.name })) },
    { name: "church_id", label: "Igreja", type: "select", options: () => churches.map((c) => ({ value: c.id, label: c.short_name })) },
    { name: "frequency", label: "Frequência", type: "select", options: Object.entries(recurrenceFrequencyLabels).map(([value, label]) => ({ value, label })) },
    { name: "weekday", label: "Dia da semana", type: "select", options: weekdayLabels.map((label, value) => ({ value: String(value), label })) },
    { name: "start_time", label: "Hora", type: "time" },
    { name: "duration_minutes", label: "Duração (min)", type: "number" },
    { name: "is_campo_wide", label: "Evento de todo o campo", type: "checkbox" },
    { name: "is_shared", label: "Divulgar nas demais igrejas", type: "checkbox" },
    { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
  ];

  const recMutation = useMutation({
    mutationFn: (values: RecurrenceValues) => {
      const payload = { ...values, church_id: values.is_campo_wide ? null : values.church_id };
      if (editingRec) return updateEventRecurrence(editingRec.id, payload as Partial<EventRecurrence>);
      if (!profile) throw new Error("Sessão não carregada.");
      return createEventRecurrence({ ...(payload as Partial<EventRecurrence>), organization_id: profile.organization_id } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-recurrences"] });
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Recorrência salva. Ocorrências futuras já materializadas foram atualizadas.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  // Eventos avulsos ---------------------------------------------------------
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);

  const eventFields: RecordField<EventValues>[] = [
    { name: "title", label: "Título", type: "text", colSpan: 2 },
    { name: "event_type_id", label: "Tipo de evento", type: "select", options: () => (eventTypes ?? []).map((t) => ({ value: t.id, label: t.name })) },
    { name: "church_id", label: "Igreja", type: "select", options: () => churches.map((c) => ({ value: c.id, label: c.short_name })) },
    { name: "starts_at", label: "Data e hora", type: "text", placeholder: "AAAA-MM-DDTHH:MM" },
    { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
  ];

  const eventMutation = useMutation({
    mutationFn: (values: EventValues) => {
      if (editingEvent) return updateEvent(editingEvent.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createEvent({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Evento salvo.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  return (
    <ModulePage title="Eventos" description="Tipos de evento, recorrências e eventos avulsos.">
      <Tabs defaultValue="recorrencias">
        <TabsList>
          <TabsTrigger value="tipos">Tipos de evento</TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
          <TabsTrigger value="avulsos">Eventos deste mês</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos">
          {isAdmin && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => { setEditingType(null); setTypeDialogOpen(true); }}>
                <Plus /> Novo tipo
              </Button>
            </div>
          )}
          <CrudTable
            rows={eventTypes}
            isLoading={loadingTypes}
            rowKey={(t) => t.id}
            emptyTitle="Nenhum tipo de evento"
            onEdit={isAdmin ? (t) => { setEditingType(t); setTypeDialogOpen(true); } : undefined}
            onDelete={isAdmin ? (t) => deleteEventType(t.id).then(() => queryClient.invalidateQueries({ queryKey: ["event-types"] })) : undefined}
            columns={[
              { header: "Nome", cell: (t) => t.name },
              { header: "Duração padrão", cell: (t) => `${t.default_duration_minutes} min` },
              { header: "Santa Ceia", cell: (t) => (t.allows_lords_supper ? <Badge variant="accent">Permite</Badge> : "—") },
            ]}
          />
        </TabsContent>

        <TabsContent value="recorrencias">
          {isAdmin && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => { setEditingRec(null); setRecDialogOpen(true); }}>
                <Plus /> Nova recorrência
              </Button>
            </div>
          )}
          <CrudTable
            rows={recurrences}
            isLoading={loadingRecurrences}
            rowKey={(r) => r.id}
            emptyTitle="Nenhuma recorrência cadastrada"
            onEdit={isAdmin ? (r) => { setEditingRec(r); setRecDialogOpen(true); } : undefined}
            onDelete={isAdmin ? (r) => deleteEventRecurrence(r.id).then(() => queryClient.invalidateQueries({ queryKey: ["event-recurrences"] })) : undefined}
            columns={[
              { header: "Nome", cell: (r) => r.name },
              { header: "Igreja", cell: (r) => (r.is_campo_wide ? <Badge>Todo o campo</Badge> : r.church_id ? churchNameById.get(r.church_id) ?? "—" : "—") },
              { header: "Quando", cell: (r) => `${weekdayLabels[r.weekday]}, ${r.start_time.slice(0, 5)}` },
              { header: "Frequência", cell: (r) => recurrenceFrequencyLabels[r.frequency] },
              { header: "Divulgado", cell: (r) => (r.is_shared ? <Badge variant="info">Sim</Badge> : "—") },
            ]}
          />
        </TabsContent>

        <TabsContent value="avulsos">
          {isAdmin && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                <Plus /> Novo evento
              </Button>
            </div>
          )}
          <CrudTable
            rows={(occurrences ?? []).filter((o) => !o.isProjected) as EventRow[]}
            isLoading={loadingEvents}
            rowKey={(e) => e.id}
            emptyTitle="Nenhum evento materializado neste mês"
            onEdit={isAdmin ? (e) => { setEditingEvent(e); setEventDialogOpen(true); } : undefined}
            onDelete={isAdmin ? (e) => deleteEvent(e.id).then(() => queryClient.invalidateQueries({ queryKey: ["occurrences"] })) : undefined}
            columns={[
              { header: "Título", cell: (e) => e.title },
              { header: "Igreja", cell: (e) => (e.is_campo_wide ? <Badge>Todo o campo</Badge> : e.church_id ? churchNameById.get(e.church_id) ?? "—" : "—") },
              { header: "Data", cell: (e) => `${formatDateBR(e.starts_at)} ${formatTimeBR(e.starts_at)}` },
              { header: "Tipo", cell: (e) => eventTypeNameById.get(e.event_type_id) ?? "—" },
            ]}
          />
        </TabsContent>
      </Tabs>

      <RecordDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        title={editingType ? "Editar tipo de evento" : "Novo tipo de evento"}
        schema={eventTypeSchema}
        fields={typeFields}
        defaultValues={{
          name: editingType?.name ?? "",
          allows_lords_supper: editingType?.allows_lords_supper ?? false,
          default_duration_minutes: editingType?.default_duration_minutes ?? 60,
        }}
        onSubmit={(v) => typeMutation.mutateAsync(v)}
      />

      <RecordDialog
        open={recDialogOpen}
        onOpenChange={setRecDialogOpen}
        title={editingRec ? "Editar recorrência" : "Nova recorrência"}
        schema={recurrenceSchema}
        fields={recFields}
        defaultValues={{
          name: editingRec?.name ?? "",
          event_type_id: editingRec?.event_type_id ?? "",
          church_id: editingRec?.church_id ?? null,
          frequency: editingRec?.frequency ?? "weekly",
          weekday: editingRec?.weekday ?? 0,
          start_time: editingRec?.start_time?.slice(0, 5) ?? "19:00",
          duration_minutes: editingRec?.duration_minutes ?? 90,
          is_campo_wide: editingRec?.is_campo_wide ?? false,
          is_shared: editingRec?.is_shared ?? false,
          notes: editingRec?.notes ?? "",
        }}
        onSubmit={(v) => recMutation.mutateAsync(v)}
      />

      <RecordDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        title={editingEvent ? "Editar evento" : "Novo evento"}
        schema={eventSchema}
        fields={eventFields}
        defaultValues={{
          title: editingEvent?.title ?? "",
          event_type_id: editingEvent?.event_type_id ?? "",
          church_id: editingEvent?.church_id ?? null,
          starts_at: editingEvent?.starts_at?.slice(0, 16) ?? `${todayDateOnly()}T19:00`,
          notes: editingEvent?.notes ?? "",
        }}
        onSubmit={(v) => eventMutation.mutateAsync(v)}
      />
    </ModulePage>
  );
}
