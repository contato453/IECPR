import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Plus, Upload } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudTable } from "@/components/CrudTable";
import { RecordDialog, type RecordField } from "@/components/RecordDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isPersonIncomplete,
  listChurches,
  listPeople,
  softDeleteRow,
  syncPersonQualifications,
  updatePerson,
  createPerson,
  type PersonWithQualifications,
} from "@/features/core/api";
import { importMembers, parseMembersSpreadsheet, type ImportedMemberRow } from "@/lib/import.functions";
import { useSession } from "@/hooks/useSession";
import { calculateAge } from "@/lib/date";
import { qualificationLabels, situationLabels } from "@/lib/labels";
import type { MinisterialQualification, PersonSituation } from "@/types/domain";
import { Checkbox } from "@/components/ui/checkbox";

const personSchema = z.object({
  full_name: z.string().min(2, "Informe o nome completo."),
  church_id: z.string().uuid().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  birth_date: z.string().optional(),
  situation: z.enum(["ativo", "desligado", "excluído", "falecido", "transferido"]).optional(),
  notes: z.string().optional(),
});
type PersonValues = z.infer<typeof personSchema>;

const situationOptions = Object.entries(situationLabels).map(([value, label]) => ({ value, label }));
const qualificationEntries = Object.entries(qualificationLabels) as [MinisterialQualification, string][];

export function PessoasPage() {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersonWithQualifications | null>(null);
  const [qualDialogOpen, setQualDialogOpen] = useState(false);
  const [qualEditing, setQualEditing] = useState<PersonWithQualifications | null>(null);
  const [selectedQuals, setSelectedQuals] = useState<Set<MinisterialQualification>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportedMemberRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<{ churchId: string; situation: string; search: string }>({
    churchId: "all",
    situation: "all",
    search: "",
  });

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: people, isLoading, error } = useQuery({
    queryKey: ["people", filters],
    queryFn: () =>
      listPeople({
        churchId: filters.churchId === "all" ? undefined : filters.churchId,
        situation: filters.situation === "all" ? undefined : (filters.situation as PersonSituation),
        search: filters.search || undefined,
        includeInactive: filters.situation !== "all",
      }),
  });

  const churchNameById = useMemo(() => new Map(churches.map((c) => [c.id, c.short_name])), [churches]);

  const fields: RecordField<PersonValues>[] = [
    { name: "full_name", label: "Nome completo", type: "text", colSpan: 2 },
    { name: "church_id", label: "Igreja", type: "select", options: () => churches.map((c) => ({ value: c.id, label: c.short_name })) },
    { name: "situation", label: "Situação", type: "select", options: situationOptions },
    { name: "phone", label: "Telefone", type: "tel" },
    { name: "email", label: "E-mail", type: "email" },
    { name: "birth_date", label: "Data de nascimento", type: "date" },
    { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
  ];

  const saveMutation = useMutation({
    mutationFn: async (values: PersonValues) => {
      if (editing) return updatePerson(editing.id, values);
      if (!profile) throw new Error("Sessão não carregada.");
      return createPerson({ ...values, organization_id: profile.organization_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Membro salvo.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteRow("people", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Membro removido.");
    },
  });

  const qualMutation = useMutation({
    mutationFn: async () => {
      if (!qualEditing) return;
      await syncPersonQualifications(qualEditing.id, Array.from(selectedQuals));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Cargos atualizados.");
      setQualDialogOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar cargos."),
  });

  async function handleFileSelected(file: File) {
    const rows = await parseMembersSpreadsheet(file);
    setImportRows(rows);
  }

  async function handleConfirmImport() {
    if (!profile) return;
    setImporting(true);
    try {
      const result = await importMembers(profile.organization_id, importRows);
      toast.success(`${result.created} membro(s) importado(s). ${result.skipped} ignorado(s).`);
      if (result.errors.length > 0) {
        console.warn("Erros na importação:", result.errors);
      }
      queryClient.invalidateQueries({ queryKey: ["people"] });
      setImportOpen(false);
      setImportRows([]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <ModulePage
      title="Membros"
      description="Cadastro ministerial da igreja e das congregações."
      actions={
        <>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload /> Importar planilha
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus /> Novo membro
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          placeholder="Buscar por nome…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select value={filters.churchId} onValueChange={(v) => setFilters((f) => ({ ...f, churchId: v }))}>
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
        <Select value={filters.situation} onValueChange={(v) => setFilters((f) => ({ ...f, situation: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Somente ativos</SelectItem>
            {situationOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CrudTable
        rows={people}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        rowKey={(p) => p.id}
        emptyTitle="Nenhum membro encontrado"
        onEdit={(p) => { setEditing(p); setDialogOpen(true); }}
        onDelete={(p) => deleteMutation.mutate(p.id)}
        extraActions={(p) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQualEditing(p);
              setSelectedQuals(new Set(p.person_qualifications.map((q) => q.qualification)));
              setQualDialogOpen(true);
            }}
          >
            Cargos
          </Button>
        )}
        columns={[
          {
            header: "Nome",
            cell: (p) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.full_name}</span>
                {isPersonIncomplete(p) && (
                  <span title="Cadastro incompleto — faltam dados obrigatórios">
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" /> ATENÇÃO DE PR. IZAIAS
                    </Badge>
                  </span>
                )}
              </div>
            ),
          },
          { header: "Igreja", cell: (p) => (p.church_id ? churchNameById.get(p.church_id) ?? "—" : "—") },
          {
            header: "Cargo/Qualificação",
            cell: (p) => p.person_qualifications.map((q) => qualificationLabels[q.qualification]).join(", ") || "—",
          },
          { header: "Telefone", cell: (p) => p.phone ?? "—" },
          { header: "Idade", cell: (p) => (p.birth_date ? calculateAge(p.birth_date) : "—") },
          {
            header: "Situação",
            cell: (p) => <Badge variant={p.situation === "ativo" ? "success" : "outline"}>{situationLabels[p.situation]}</Badge>,
          },
        ]}
      />

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar membro" : "Novo membro"}
        schema={personSchema}
        fields={fields}
        defaultValues={{
          full_name: editing?.full_name ?? "",
          church_id: editing?.church_id ?? null,
          phone: editing?.phone ?? "",
          email: editing?.email ?? "",
          birth_date: editing?.birth_date ?? "",
          situation: editing?.situation ?? "ativo",
          notes: editing?.notes ?? "",
        }}
        onSubmit={(values) => saveMutation.mutateAsync(values)}
      />

      <Dialog open={qualDialogOpen} onOpenChange={setQualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargos de {qualEditing?.full_name}</DialogTitle>
            <DialogDescription>Qualificação ministerial — não interfere no perfil de acesso ao sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {qualificationEntries.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  checked={selectedQuals.has(value)}
                  onCheckedChange={(checked) => {
                    setSelectedQuals((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(value);
                      else next.delete(value);
                      return next;
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => qualMutation.mutate()} disabled={qualMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar planilha de membros</DialogTitle>
            <DialogDescription>
              Arquivo .xlsx com colunas Nome, Telefone, E-mail, Data de nascimento, Igreja e Observações.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          {importRows.length > 0 && (
            <p className="text-sm text-muted-foreground">{importRows.length} linha(s) reconhecida(s) na planilha.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmImport} disabled={importRows.length === 0 || importing}>
              Importar {importRows.length > 0 ? `(${importRows.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
