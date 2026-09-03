import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/DataState";
import { listChurches } from "@/features/core/api";
import { listEventTypes, listOccurrences } from "@/features/events/api";
import { computeOccurrenceStatus, createScheduleAndOccurrenceForEvent, listScheduleItemsByEventIds } from "@/features/schedules/api";
import { useSession } from "@/hooks/useSession";
import { addDaysDateOnly, formatTimeBR, todayDateOnly } from "@/lib/date";
import type { EventRow } from "@/types/domain";

/** Card "Próximos cultos" do painel. */
export function UpcomingServices({ limit = 5 }: { limit?: number }) {
  const { profile } = useSession();
  const navigate = useNavigate();

  const periodStart = todayDateOnly();
  const periodEnd = useMemo(() => addDaysDateOnly(periodStart, 21), [periodStart]);

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: eventTypes = [] } = useQuery({ queryKey: ["event-types"], queryFn: listEventTypes });
  const { data: occurrences, isLoading } = useQuery({
    queryKey: ["occurrences", "upcoming-services", periodStart, periodEnd],
    queryFn: () => listOccurrences(periodStart, periodEnd),
  });

  const upcoming = (occurrences ?? []).slice(0, limit);
  const materializedIds = upcoming.filter((o) => !o.isProjected).map((o) => (o as EventRow).id);
  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["schedule-items-bulk", "upcoming", materializedIds],
    queryFn: () => listScheduleItemsByEventIds(materializedIds),
    enabled: materializedIds.length > 0,
  });

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));
  const eventTypeById = new Map(eventTypes.map((t) => [t.id, t]));

  const assignMutation = useMutation({
    mutationFn: (occurrence: (typeof upcoming)[number]) => createScheduleAndOccurrenceForEvent(profile!.organization_id, occurrence),
    onSuccess: ({ schedule, event }) => navigate(`/escalas/${schedule.id}?eventId=${event.id}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao abrir escala."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos cultos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingState />}
        {!isLoading && upcoming.length === 0 && <EmptyState title="Nenhum culto nos próximos dias" />}
        <div className="flex flex-col divide-y divide-border">
          {upcoming.map((occ) => {
            const eventType = eventTypeById.get(occ.event_type_id);
            const eventId = occ.isProjected ? null : occ.id;
            const items = eventId ? scheduleItems.filter((si) => si.event_id === eventId) : [];
            const status = computeOccurrenceStatus(eventType, items);
            const leader = items.find((i) => i.kind === "leader" && i.person_id);
            const preacher = items.find((i) => i.kind === "preacher" && i.person_id);
            const churchLabel = occ.is_campo_wide ? "Todo o campo" : occ.church_id ? churchNameById.get(occ.church_id) ?? "—" : "—";

            return (
              <div key={occ.starts_at + occ.title} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{churchLabel}</Badge>
                  <span className="font-medium">{formatTimeBR(occ.starts_at)}</span>
                </div>
                <p className="font-medium">{occ.title}</p>
                {occ.notes && <p className="text-sm text-muted-foreground">{occ.notes}</p>}
                {!status.isExempt && (
                  <p className="text-sm">
                    Dirigente: {leader ? leader.people?.full_name : <span className="text-destructive">pendente</span>} · Pregador:{" "}
                    {preacher ? preacher.people?.full_name : <span className="text-destructive">pendente</span>}
                  </p>
                )}
                {!status.isExempt && (
                  <Button size="sm" variant="outline" className="mt-1 self-start" onClick={() => assignMutation.mutate(occ)}>
                    Conferir escala
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
