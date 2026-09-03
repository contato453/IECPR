import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudTable } from "@/components/CrudTable";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import { createDepartment, listChurches, listDepartments, softDeleteRow, updateDepartment } from "@/features/core/api";
import { useSession } from "@/hooks/useSession";
import type { Department } from "@/types/domain";

const departmentSchema = z.object({
  church_id: z.string().uuid("Selecione a igreja."),
  name: z.string().min(2, "Informe o nome do departamento."),
  description: z.string().optional(),
});
type DepartmentValues = z.infer<typeof departmentSchema>;

export function DepartamentosPage() {
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [filterChurch, setFilterChurch] = useState<string>("all");

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: departments, isLoading, error } = useQuery({
    queryKey: ["departments", filterChurch],
    queryFn: () => listDepartments(filterChurch === "all" ? undefined : filterChurch),
  });

  const churchNameById = useMemo(() => new Map(churches.map((c) => [c.id, c.short_name])), [churches]);

  const fields: RecordField<DepartmentValues>[] = [
    {
      name: "church_id",
      label: "Igreja",
      type: "select",
      colSpan: 2,
      options: () => churches.map((c) => ({ value: c.id, label: c.short_name })),
    },
    { name: "name", label: "Nome", type: "text", colSpan: 2 },
    { name: "description", label: "Descrição", type: "textarea", colSpan: 2 },
  ];

  const saveMutation = useMutation({
    mutationFn: async (values: DepartmentValues) => {
      if (editing) return updateDepartment(editing.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createDepartment({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento salvo.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteRow("departments", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento removido.");
    },
  });

  return (
    <ModulePage
      title="Departamentos"
      description="DEPIN, Homens, Jovens, Mulheres e outros, por igreja."
      actions={
        isAdmin && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus /> Novo departamento
          </Button>
        )
      }
    >
      <div className="mb-4 max-w-xs">
        <Select value={filterChurch} onValueChange={setFilterChurch}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por igreja" />
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
        rows={departments}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        rowKey={(d) => d.id}
        emptyTitle="Nenhum departamento encontrado"
        onEdit={isAdmin ? (d) => { setEditing(d); setDialogOpen(true); } : undefined}
        onDelete={isAdmin ? (d) => deleteMutation.mutate(d.id) : undefined}
        columns={[
          { header: "Nome", cell: (d) => d.name },
          { header: "Igreja", cell: (d) => (d.church_id ? churchNameById.get(d.church_id) ?? "—" : "Campo") },
          { header: "Descrição", cell: (d) => d.description ?? "—" },
          { header: "Status", cell: (d) => (d.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>) },
        ]}
      />

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar departamento" : "Novo departamento"}
        schema={departmentSchema}
        fields={fields}
        defaultValues={{
          church_id: editing?.church_id ?? "",
          name: editing?.name ?? "",
          description: editing?.description ?? "",
        }}
        onSubmit={(values) => saveMutation.mutateAsync(values)}
      />
    </ModulePage>
  );
}
