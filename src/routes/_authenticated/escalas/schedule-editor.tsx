import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonCombobox } from "@/components/PersonCombobox";
import { LoadingState, EmptyState } from "@/components/DataState";
import { listEventTypes, ensureOccurrence, occurrenceId } from "@/features/events/api";
import { listOccurrences } from "@/features/events/api";
import {
  computeOccurrenceStatus,
  getSchedule,
  listScheduleItems,
  removeScheduleItem,
  setScheduleStatus,
  upsertScheduleItem,
} from "@/features/schedules/api";
import { availableTransitions } from "@/features/workflow";
import { useSession } from "@/hooks/useSession";
import { formatDayHeader, formatTimeBR } from "@/lib/date";
import type { Occurrence, ScheduleItem, UUID } from "@/types/domain";

export function ScheduleEditorPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();
  const focusedEventId = searchParams.get("eventId");
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ["schedule", scheduleId],
    queryFn: () => getSchedule(scheduleId as string),
    enabled: !!scheduleId,
  });

  const { data: occurrences, isLoading: loadingOccurrences } = useQuery({
    queryKey: ["occurrences", "schedule-editor", schedule?.id],
    queryFn: () => listOccurrences(schedule!.period_start, schedule!.period_end, { churchId: schedule!.church_id }),
    enabled: !!schedule,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["schedule-items", scheduleId],
    queryFn: () => listScheduleItems(scheduleId as string),
    enabled: !!scheduleId,
  });

  const { data: eventTypes = [] } = useQuery({ queryKey: ["event-types"], queryFn: listEventTypes });
  const eventTypeById = useMemo(() => new Map(eventTypes.map((t) => [t.id, t])), [eventTypes]);

  const itemsByEventId = useMemo(() => {
    const map = new Map<UUID, ScheduleItem[]>();
    for (const item of items) {
      if (!item.event_id) continue;
      const list = map.get(item.event_id) ?? [];
      list.push(item);
      map.set(item.event_id, list);
    }
    return map;
  }, [items]);

  // Aceita tanto uuid quanto a chave projetada "rec:<id>:<data>" — Bug #2.
  const visibleOccurrences = useMemo(() => {
    if (!occurrences) return [];
    if (!focusedEventId) return occurrences;
    return occurrences.filter((o) => occurrenceId(o) === focusedEventId);
  }, [occurrences, focusedEventId]);

  async function assignPerson(occurrence: Occurrence, kind: "leader" | "preacher", personId: UUID | null) {
    if (!schedule || !profile) return;
    const key = `${occurrenceId(occurrence)}:${kind}`;
    setBusyKey(key);
    try {
      const event = await ensureOccurrence(occurrenceId(occurrence), profile.organization_id);
      const existing = (itemsByEventId.get(event.id) ?? []).find((i) => i.kind === kind);
      await upsertScheduleItem({
        id: existing?.id,
        schedule_id: schedule.id,
        event_id: event.id,
        kind,
        person_id: personId,
      });
      await queryClient.invalidateQueries({ queryKey: ["schedule-items", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["occurrences"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar escala.");
    } finally {
      setBusyKey(null);
    }
  }

  async function addOpportunity(occurrence: Occurrence) {
    if (!schedule || !profile) return;
    const event = await ensureOccurrence(occurrenceId(occurrence), profile.organization_id);
    await upsertScheduleItem({ schedule_id: schedule.id, event_id: event.id, kind: "opportunity", opportunity_label: "Nova oportunidade" });
    await queryClient.invalidateQueries({ queryKey: ["schedule-items", scheduleId] });
  }

  const transitionMutation = useMutation({
    mutationFn: (status: Parameters<typeof setScheduleStatus>[1]) => setScheduleStatus(scheduleId as string, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", scheduleId] });
      toast.success("Escala atualizada.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar escala."),
  });

  if (loadingSchedule || loadingOccurrences || loadingItems) return <LoadingState />;
  if (!schedule) return <EmptyState title="Escala não encontrada" />;

  const transitions = availableTransitions(schedule.status, isAdmin);

  return (
    <ModulePage
      title={schedule.title}
      description="Dirigente, pregador e oportunidades de cada culto do período."
      actions={transitions.map((t) => (
        <Button key={t.action} variant={t.to === "cancelled" ? "destructive" : "default"} onClick={() => transitionMutation.mutate(t.to)}>
          {t.action}
        </Button>
      ))}
    >
      {visibleOccurrences.length === 0 && <EmptyState title="Nenhuma ocorrência no período" />}

      <div className="flex flex-col gap-4">
        {visibleOccurrences.map((occurrence) => {
          const eventType = eventTypeById.get(occurrence.event_type_id);
          const eventItems = occurrence.isProjected ? [] : itemsByEventId.get(occurrence.id) ?? [];
          const status = computeOccurrenceStatus(eventType, eventItems);
          const leaderItem = eventItems.find((i) => i.kind === "leader");
          const preacherItem = eventItems.find((i) => i.kind === "preacher");
          const opportunities = eventItems.filter((i) => i.kind === "opportunity");

          return (
            <Card key={occurrenceId(occurrence)}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {formatDayHeader(occurrence.starts_at)} · {formatTimeBR(occurrence.starts_at)} — {occurrence.title}
                  </CardTitle>
                  {occurrence.notes && <p className="mt-1 text-sm text-muted-foreground">{occurrence.notes}</p>}
                </div>
                {!status.isExempt &&
                  (status.isComplete ? (
                    <Badge variant="success">Escala completa</Badge>
                  ) : (
                    <Badge variant="destructive">Escala pendente</Badge>
                  ))}
                {status.isExempt && <Badge variant="outline">Sem escala (EBD)</Badge>}
              </CardHeader>
              {!status.isExempt && (
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Dirigente</Label>
                    <div className="mt-1.5">
                      <PersonCombobox
                        value={leaderItem?.person_id ?? null}
                        organizationId={profile?.organization_id ?? ""}
                        disabled={busyKey === `${occurrenceId(occurrence)}:leader`}
                        onChange={(personId) => assignPerson(occurrence, "leader", personId)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Pregador</Label>
                    <div className="mt-1.5">
                      <PersonCombobox
                        value={preacherItem?.person_id ?? null}
                        organizationId={profile?.organization_id ?? ""}
                        disabled={busyKey === `${occurrenceId(occurrence)}:preacher`}
                        onChange={(personId) => assignPerson(occurrence, "preacher", personId)}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label>Oportunidades</Label>
                      <Button variant="ghost" size="sm" onClick={() => addOpportunity(occurrence)}>
                        <Plus className="size-4" /> Adicionar
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {opportunities.map((op) => (
                        <OpportunityRow
                          key={op.id}
                          item={op}
                          organizationId={profile?.organization_id ?? ""}
                          onRemove={() => removeScheduleItem(op.id).then(() => queryClient.invalidateQueries({ queryKey: ["schedule-items", scheduleId] }))}
                          onChange={() => queryClient.invalidateQueries({ queryKey: ["schedule-items", scheduleId] })}
                        />
                      ))}
                      {opportunities.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oportunidade cadastrada.</p>}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </ModulePage>
  );
}

function OpportunityRow({
  item,
  organizationId,
  onRemove,
  onChange,
}: {
  item: ScheduleItem;
  organizationId: string;
  onRemove: () => void;
  onChange: () => void;
}) {
  const [label, setLabel] = useState(item.opportunity_label ?? "");

  async function saveLabel() {
    await upsertScheduleItem({ id: item.id, schedule_id: item.schedule_id, kind: "opportunity", opportunity_label: label });
    onChange();
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={saveLabel} className="max-w-48" />
      <div className="flex-1">
        <PersonCombobox
          value={item.person_id}
          organizationId={organizationId}
          onChange={async (personId) => {
            await upsertScheduleItem({ id: item.id, schedule_id: item.schedule_id, kind: "opportunity", person_id: personId });
            onChange();
          }}
        />
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
