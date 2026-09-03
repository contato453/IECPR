import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingState } from "@/components/DataState";
import { listOccurrences } from "@/features/events/api";
import { addDaysDateOnly, formatDateBR, formatTimeBR, todayDateOnly } from "@/lib/date";
import { listChurches } from "@/features/core/api";

/** Lista consolidada dos eventos da próxima semana, de todas as igrejas, pronta para impressão. */
export function AvisosDaSemanaPage() {
  const [days, setDays] = useState(7);
  const periodStart = todayDateOnly();
  const periodEnd = useMemo(() => addDaysDateOnly(periodStart, days), [periodStart, days]);

  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: occurrences, isLoading } = useQuery({
    queryKey: ["occurrences", "avisos-da-semana", periodStart, periodEnd],
    queryFn: () => listOccurrences(periodStart, periodEnd),
  });

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));

  return (
    <ModulePage
      title="Avisos da semana"
      description={`Eventos de ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}, de todas as igrejas.`}
      actions={
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      }
    >
      <div className="mb-4 flex gap-2 iecpr-no-print">
        {[7, 14, 30].map((n) => (
          <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)}>
            {n} dias
          </Button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {!isLoading && (!occurrences || occurrences.length === 0) && <EmptyState title="Sem eventos no período" />}

      {occurrences && occurrences.length > 0 && (
        <div className="rounded-lg border border-border bg-card iecpr-print-area">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Igreja</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occurrences.map((occ) => (
                <TableRow key={occ.starts_at + occ.title}>
                  <TableCell>{formatDateBR(occ.starts_at)}</TableCell>
                  <TableCell>{formatTimeBR(occ.starts_at)}</TableCell>
                  <TableCell>
                    {occ.is_campo_wide ? (
                      <Badge variant="accent">Todo o campo</Badge>
                    ) : (
                      churchNameById.get(occ.church_id ?? "") ?? "—"
                    )}
                    {occ.is_shared && !occ.is_campo_wide && (
                      <Badge variant="info" className="ml-1">
                        Divulgado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{occ.title}</TableCell>
                  <TableCell className="iecpr-clamp-1">{occ.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ModulePage>
  );
}
