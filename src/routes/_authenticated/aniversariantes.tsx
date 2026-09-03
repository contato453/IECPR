import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingState } from "@/components/DataState";
import { listBirthdaysInMonth, listChurches } from "@/features/core/api";
import { qualificationLabels } from "@/lib/labels";

/** Idade que a pessoa completa no aniversário deste ano — não a idade atual. */
function ageTurningThisYear(birthDate: string): number {
  const birthYear = Number(birthDate.split("-")[0]);
  return new Date().getFullYear() - birthYear;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function AniversariantesPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: people, isLoading } = useQuery({
    queryKey: ["birthdays", month],
    queryFn: () => listBirthdaysInMonth(month),
  });

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));

  return (
    <ModulePage
      title="Aniversariantes do mês"
      description="Membros que fazem aniversário no mês selecionado."
      actions={
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      }
    >
      <div className="mb-4 max-w-48 iecpr-no-print">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger>
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
      </div>

      {isLoading && <LoadingState />}
      {!isLoading && (!people || people.length === 0) && <EmptyState title="Nenhum aniversariante neste mês" />}

      {people && people.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Igreja</TableHead>
                <TableHead>Cargo/Qualificação</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Idade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.church_id ? churchNameById.get(p.church_id) ?? "—" : "—"}</TableCell>
                  <TableCell>{p.person_qualifications.map((q) => qualificationLabels[q.qualification]).join(", ") || "—"}</TableCell>
                  <TableCell>{p.birth_date!.split("-")[2]}</TableCell>
                  <TableCell>{ageTurningThisYear(p.birth_date!)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ModulePage>
  );
}
