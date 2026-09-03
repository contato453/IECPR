import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonCombobox } from "@/components/PersonCombobox";
import { EmptyState, LoadingState } from "@/components/DataState";
import { listChurches, listDepartments } from "@/features/core/api";
import {
  createDepartmentAgenda,
  getCurrentWeekAgenda,
  isLate,
  listDepartmentAgendaItems,
  removeDepartmentAgendaItem,
  setDepartmentAgendaStatus,
  upsertDepartmentAgendaItem,
} from "@/features/agendas/api";
import { availableTransitions } from "@/features/workflow";
import { useSession } from "@/hooks/useSession";
import { formatDateBR, startOfWeekSunday, todayDateOnly } from "@/lib/date";
import { workflowStatusLabels } from "@/lib/labels";

export function AgendasPage() {
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();
  const [churchId, setChurchId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const currentChurch = churchId || churches[0]?.id || "";

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", currentChurch],
    queryFn: () => listDepartments(currentChurch),
    enabled: !!currentChurch,
  });
  const currentDepartment = departmentId || departments[0]?.id || "";

  const weekStart = useMemo(() => startOfWeekSunday(todayDateOnly()), []);

  const { data: agenda, isLoading: loadingAgenda } = useQuery({
    queryKey: ["department-agenda", currentChurch, currentDepartment, weekStart],
    queryFn: () => getCurrentWeekAgenda(currentChurch, currentDepartment),
    enabled: !!currentChurch && !!currentDepartment,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["department-agenda-items", agenda?.id],
    queryFn: () => listDepartmentAgendaItems(agenda!.id),
    enabled: !!agenda,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Sessão não carregada.");
      const church = churches.find((c) => c.id === currentChurch);
      const department = departments.find((d) => d.id === currentDepartment);
      return createDepartmentAgenda({
        organization_id: profile.organization_id,
        church_id: currentChurch,
        department_id: currentDepartment,
        title: `${department?.name ?? "Departamento"} · ${church?.short_name ?? ""} · semana de ${formatDateBR(weekStart)}`,
        week_start: weekStart,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-agenda"] });
      toast.success("Agenda da semana criada.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar agenda."),
  });

  const addItemMutation = useMutation({
    mutationFn: () =>
      upsertDepartmentAgendaItem({
        agenda_id: agenda!.id,
        title: "Novo item",
        item_date: weekStart,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["department-agenda-items", agenda?.id] }),
  });

  const transitionMutation = useMutation({
    mutationFn: (status: Parameters<typeof setDepartmentAgendaStatus>[1]) => setDepartmentAgendaStatus(agenda!.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-agenda"] });
      toast.success("Status atualizado.");
    },
  });

  const late = agenda ? isLate(agenda) : false;
  const transitions = agenda ? availableTransitions(agenda.status, isAdmin) : [];

  return (
    <ModulePage title="Agendas departamentais" description="Programação semanal de cada departamento, com prazo de entrega.">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-lg">
        <Select value={currentChurch} onValueChange={(v) => { setChurchId(v); setDepartmentId(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Igreja" />
          </SelectTrigger>
          <SelectContent>
            {churches.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.short_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentDepartment} onValueChange={setDepartmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingAgenda && <LoadingState />}

      {!loadingAgenda && !agenda && currentChurch && currentDepartment && (
        <EmptyState
          title="Nenhuma agenda para esta semana ainda"
          description={`Semana de ${formatDateBR(weekStart)}. Crie a agenda para começar a lançar os itens.`}
        />
      )}
      {!loadingAgenda && !agenda && currentChurch && currentDepartment && (
        <Button className="mt-3" onClick={() => createMutation.mutate()}>
          <Plus /> Criar agenda da semana
        </Button>
      )}

      {agenda && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{agenda.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Prazo: {new Date(agenda.deadline_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                {late && (
                  <Badge variant="destructive" className="ml-2">
                    Atrasada
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{workflowStatusLabels[agenda.status]}</Badge>
              {transitions.map((t) => (
                <Button key={t.action} size="sm" variant={t.to === "cancelled" ? "destructive" : "outline"} onClick={() => transitionMutation.mutate(t.to)}>
                  {t.action}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => addItemMutation.mutate()}>
                <Plus className="size-4" /> Novo item
              </Button>
            </div>
            {loadingItems && <LoadingState />}
            {!loadingItems && items.length === 0 && <EmptyState title="Nenhum item nesta agenda" />}
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <AgendaItemRow key={item.id} item={item} organizationId={profile?.organization_id ?? ""} agendaId={agenda.id} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ModulePage>
  );
}

function AgendaItemRow({
  item,
  organizationId,
  agendaId,
}: {
  item: { id: string; title: string; description: string | null; item_date: string; responsible_person_id: string | null };
  organizationId: string;
  agendaId: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(item.title);

  async function saveTitle() {
    await upsertDepartmentAgendaItem({ id: item.id, agenda_id: agendaId, title, item_date: item.item_date });
    queryClient.invalidateQueries({ queryKey: ["department-agenda-items", agendaId] });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} className="sm:max-w-56" />
      <Label className="sr-only">Responsável</Label>
      <div className="flex-1">
        <PersonCombobox
          value={item.responsible_person_id}
          organizationId={organizationId}
          placeholder="Responsável"
          onChange={async (personId) => {
            await upsertDepartmentAgendaItem({ id: item.id, agenda_id: agendaId, title: item.title, item_date: item.item_date, responsible_person_id: personId });
            queryClient.invalidateQueries({ queryKey: ["department-agenda-items", agendaId] });
          }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeDepartmentAgendaItem(item.id).then(() => queryClient.invalidateQueries({ queryKey: ["department-agenda-items", agendaId] }))}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
