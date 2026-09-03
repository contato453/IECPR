import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, MessageCircle, Pencil, Printer, Trash2, Check, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/DataState";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import { listChurches } from "@/features/core/api";
import {
  cancelEvent,
  createEvent,
  listEventTypes,
  listOccurrences,
  occurrenceEndOfMonthRange,
  occurrenceId,
  updateEvent,
} from "@/features/events/api";
import {
  computeOccurrenceStatus,
  createScheduleAndOccurrenceForEvent,
  listMyPendingConfirmations,
  listScheduleItemsByEventIds,
  respondConfirmation,
} from "@/features/schedules/api";
import { enqueueNotificationJob, dispatchMockJob, renderTemplate } from "@/features/notifications/api";
import { useSession } from "@/hooks/useSession";
import { formatDayHeader, formatTimeBR, todayDateOnly } from "@/lib/date";
import { z } from "zod";
import type { EventRow, Occurrence, UUID } from "@/types/domain";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const eventSchema = z.object({
  title: z.string().min(2, "Informe o título."),
  event_type_id: z.string().uuid("Selecione o tipo de evento."),
  church_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().min(10, "Informe data e hora."),
  notes: z.string().optional(),
});
type EventValues = z.infer<typeof eventSchema>;

export function AgendaGeralPage() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [churchFilter, setChurchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: eventTypes = [] } = useQuery({ queryKey: ["event-types"], queryFn: listEventTypes });
  const eventTypeById = useMemo(() => new Map(eventTypes.map((t) => [t.id, t])), [eventTypes]);

  const { periodStart, periodEnd } = useMemo(() => occurrenceEndOfMonthRange(year, month), [year, month]);

  const { data: occurrences, isLoading } = useQuery({
    queryKey: ["occurrences", "agenda-geral", periodStart, periodEnd, churchFilter, typeFilter],
    queryFn: () =>
      listOccurrences(periodStart, periodEnd, {
        churchId: churchFilter === "all" ? undefined : churchFilter,
        eventTypeId: typeFilter === "all" ? undefined : typeFilter,
      }),
  });

  const materializedIds = useMemo(() => (occurrences ?? []).filter((o) => !o.isProjected).map((o) => (o as EventRow).id), [occurrences]);
  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["schedule-items-bulk", materializedIds],
    queryFn: () => listScheduleItemsByEventIds(materializedIds),
    enabled: materializedIds.length > 0,
  });

  const { data: myConfirmations = [] } = useQuery({
    queryKey: ["my-confirmations", profile?.person_id],
    queryFn: () => listMyPendingConfirmations(profile!.person_id as string),
    enabled: !!profile?.person_id,
  });

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const today = todayDateOnly();

  const grouped = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of occurrences ?? []) {
      const date = occ.starts_at.slice(0, 10);
      if (isCurrentMonth && date < today) continue; // Começa sempre pelo dia de hoje
      const list = map.get(date) ?? [];
      list.push(occ);
      map.set(date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences, isCurrentMonth, today]);

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));

  const assignScheduleMutation = useMutation({
    mutationFn: (occurrence: Occurrence) => createScheduleAndOccurrenceForEvent(profile!.organization_id, occurrence),
    onSuccess: ({ schedule, event }) => {
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      navigate(`/escalas/${schedule.id}?eventId=${event.id}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atribuir escala."),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: UUID) => cancelEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Evento cancelado.");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, status }: { id: UUID; status: "confirmed" | "declined" }) => respondConfirmation(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-confirmations"] });
      toast.success("Resposta registrada.");
    },
  });

  const eventFields: RecordField<EventValues>[] = [
    { name: "title", label: "Título", type: "text", colSpan: 2 },
    { name: "event_type_id", label: "Tipo de evento", type: "select", options: () => eventTypes.map((t) => ({ value: t.id, label: t.name })) },
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

  async function sendWhatsAppReminder(personName: string, phone: string | null | undefined, event: Occurrence) {
    if (!phone) {
      toast.error(`${personName} não tem telefone cadastrado.`);
      return;
    }
    if (!profile) return;
    const message = renderTemplate("Olá {{nome}}! Confirma presença no culto de {{data}} às {{hora}}?", {
      nome: personName,
      data: formatDayHeader(event.starts_at),
      hora: formatTimeBR(event.starts_at),
    });
    const job = await enqueueNotificationJob({
      organization_id: profile.organization_id,
      church_id: event.church_id,
      channel: "whatsapp",
      destination: phone,
      message,
    });
    await dispatchMockJob(job.id);
    toast.success(`Mensagem simulada enviada para ${personName}.`);
  }

  return (
    <ModulePage
      title="Agenda geral"
      description="O que acontece em cada igreja, em cada dia."
      actions={
        <>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
          <Button onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
            <CalendarPlus /> Novo evento
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3 iecpr-no-print">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, idx) => (
              <SelectItem key={name} value={String(idx + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={churchFilter} onValueChange={setChurchFilter}>
          <SelectTrigger className="w-48">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {eventTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="iecpr-print-header">
        <h2 className="font-serif text-lg font-semibold">
          Agenda geral — {monthNames[month - 1]} de {year}
        </h2>
      </div>

      {isLoading && <LoadingState />}
      {!isLoading && grouped.length === 0 && <EmptyState title="Sem eventos" description="Nenhum evento no período filtrado." />}

      <div className="iecpr-print-columns flex flex-col gap-6">
        {grouped.map(([date, dayOccurrences]) => (
          <div key={date}>
            <h3 className="mb-2 font-serif text-base font-semibold text-primary">{formatDayHeader(date)}</h3>
            <div className="flex flex-col gap-3">
              {dayOccurrences.map((occ) => {
                const eventType = eventTypeById.get(occ.event_type_id);
                const eventId = occ.isProjected ? null : occ.id;
                const items = eventId ? scheduleItems.filter((si) => si.event_id === eventId) : [];
                const status = computeOccurrenceStatus(eventType, items);
                const leader = items.find((i) => i.kind === "leader" && i.person_id);
                const preacher = items.find((i) => i.kind === "preacher" && i.person_id);
                const myConfirmation = eventId ? myConfirmations.find((c) => c.event_id === eventId) : undefined;
                const churchLabel = occ.is_campo_wide ? "Todo o campo" : occ.church_id ? churchNameById.get(occ.church_id) ?? "—" : "—";

                return (
                  <Card key={occurrenceId(occ)}>
                    <CardContent className="flex flex-col gap-2 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={occ.is_campo_wide ? "accent" : "secondary"}>{churchLabel}</Badge>
                        <span className="text-sm font-medium">{formatTimeBR(occ.starts_at)}</span>
                        {occ.is_shared && !occ.is_campo_wide && <Badge variant="info">Divulgado</Badge>}
                        {!status.isExempt &&
                          (status.isComplete ? (
                            <Badge variant="success">Escala completa</Badge>
                          ) : (
                            <Badge variant="destructive">Escala pendente</Badge>
                          ))}
                      </div>
                      <p className="font-serif text-base font-semibold">{occ.title}</p>
                      {occ.notes && <p className="iecpr-clamp-1 text-sm text-muted-foreground">{occ.notes}</p>}
                      {!status.isExempt && (
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                          <span>
                            Dirigente:{" "}
                            {leader ? (
                              <span className="font-medium">{leader.people?.full_name}</span>
                            ) : (
                              <span className="font-medium text-destructive">pendente</span>
                            )}
                          </span>
                          <span>
                            Pregador:{" "}
                            {preacher ? (
                              <span className="font-medium">{preacher.people?.full_name}</span>
                            ) : (
                              <span className="font-medium text-destructive">pendente</span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap gap-2 iecpr-no-print">
                        <Button size="sm" onClick={() => assignScheduleMutation.mutate(occ)}>
                          {status.isComplete ? "Conferir escala" : "Atribuir escala"}
                        </Button>
                        {eventId && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setEditingEvent(occ as EventRow); setEventDialogOpen(true); }}>
                              <Pencil className="size-4" /> Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(eventId)}>
                              <Trash2 className="size-4" /> Cancelar
                            </Button>
                          </>
                        )}
                        {leader?.people && (
                          <Button size="sm" variant="ghost" onClick={() => sendWhatsAppReminder(leader.people!.full_name, leader.people!.phone, occ)}>
                            <MessageCircle className="size-4" /> Avisar dirigente
                          </Button>
                        )}
                        {preacher?.people && (
                          <Button size="sm" variant="ghost" onClick={() => sendWhatsAppReminder(preacher.people!.full_name, preacher.people!.phone, occ)}>
                            <MessageCircle className="size-4" /> Avisar pregador
                          </Button>
                        )}
                        {myConfirmation && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => confirmMutation.mutate({ id: myConfirmation.id, status: "confirmed" })}>
                              <Check className="size-4 text-success" /> Confirmar presença
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmMutation.mutate({ id: myConfirmation.id, status: "declined" })}>
                              <X className="size-4 text-destructive" /> Recusar
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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
