import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/components/CrudTable";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import { createChurchWithDefaultDepartments, listChurches, softDeleteRow, updateChurch } from "@/features/core/api";
import { useSession } from "@/hooks/useSession";
import type { Church } from "@/types/domain";

const churchSchema = z.object({
  name: z.string().min(2, "Informe o nome completo da igreja."),
  short_name: z.string().min(1, "Informe o nome curto."),
  city: z.string().optional(),
  is_headquarters: z.boolean().optional(),
});
type ChurchValues = z.infer<typeof churchSchema>;

const fields: RecordField<ChurchValues>[] = [
  { name: "name", label: "Nome completo", type: "text", colSpan: 2 },
  { name: "short_name", label: "Nome curto", type: "text", description: "Usado nos badges da agenda e impressão." },
  { name: "city", label: "Cidade", type: "text" },
  { name: "is_headquarters", label: "É a igreja matriz", type: "checkbox", colSpan: 2 },
];

export function IgrejasPage() {
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Church | null>(null);

  const { data: churches, isLoading, error } = useQuery({ queryKey: ["churches"], queryFn: listChurches });

  const saveMutation = useMutation({
    mutationFn: async (values: ChurchValues) => {
      if (editing) return updateChurch(editing.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createChurchWithDefaultDepartments({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success(editing ? "Igreja atualizada." : "Igreja cadastrada com os 4 departamentos padrão.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar igreja."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteRow("churches", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      toast.success("Igreja removida.");
    },
  });

  return (
    <ModulePage
      title="Igrejas"
      description="Matriz e congregações do campo."
      actions={
        isAdmin && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus /> Nova igreja
          </Button>
        )
      }
    >
      <CrudTable
        rows={churches}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        rowKey={(c) => c.id}
        emptyTitle="Nenhuma igreja cadastrada"
        onEdit={isAdmin ? (c) => { setEditing(c); setDialogOpen(true); } : undefined}
        onDelete={isAdmin ? (c) => deleteMutation.mutate(c.id) : undefined}
        columns={[
          {
            header: "Nome",
            cell: (c) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {c.is_headquarters && (
                  <Badge variant="accent">
                    <Star className="mr-1 size-3" /> Matriz
                  </Badge>
                )}
              </div>
            ),
          },
          { header: "Nome curto", cell: (c) => c.short_name },
          { header: "Cidade", cell: (c) => c.city ?? "—" },
          { header: "Status", cell: (c) => (c.active ? <Badge variant="success">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>) },
        ]}
      />

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar igreja" : "Nova igreja"}
        description={!editing ? "Os departamentos DEPIN, Homens, Jovens e Mulheres são criados automaticamente." : undefined}
        schema={churchSchema}
        fields={fields}
        defaultValues={{
          name: editing?.name ?? "",
          short_name: editing?.short_name ?? "",
          city: editing?.city ?? "",
          is_headquarters: editing?.is_headquarters ?? false,
        }}
        onSubmit={(values) => saveMutation.mutateAsync(values)}
      />
    </ModulePage>
  );
}
