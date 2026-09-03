import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/ModulePage";
import { EmptyState } from "@/components/DataState";
import { CrudTable } from "@/components/CrudTable";
import { listAuditLog } from "@/features/core/api";
import { useSession } from "@/hooks/useSession";
import { formatDateBR, formatTimeBR } from "@/lib/date";
import type { AuditLogEntry } from "@/types/domain";

export function AuditoriaPage() {
  const { isAdmin } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ["audit-log"], queryFn: () => listAuditLog(200) });

  if (!isAdmin) {
    return (
      <ModulePage title="Auditoria">
        <EmptyState title="Acesso restrito" description="Somente o pastor administrador vê esta tela." />
      </ModulePage>
    );
  }

  return (
    <ModulePage title="Auditoria" description="Últimos 200 registros de alterações no sistema.">
      <CrudTable
        rows={data as AuditLogEntry[] | undefined}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="Nenhum registro de auditoria ainda"
        columns={[
          { header: "Data", cell: (r) => `${formatDateBR(r.created_at)} ${formatTimeBR(r.created_at)}` },
          { header: "Entidade", cell: (r) => r.entity },
          { header: "Ação", cell: (r) => r.action },
          { header: "Registro", cell: (r) => r.entity_id ?? "—" },
          {
            header: "Alterações",
            cell: (r) => (
              <pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {r.changes ? JSON.stringify(r.changes, null, 0).slice(0, 300) : "—"}
              </pre>
            ),
          },
        ]}
      />
    </ModulePage>
  );
}
