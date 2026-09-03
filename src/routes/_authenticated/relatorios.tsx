import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/DataState";
import { reportApprovalTime, reportConfirmations, reportDeadlineCompliance, reportSchedulesByPerson } from "@/features/reports/api";
import { useSession } from "@/hooks/useSession";

export function RelatoriosPage() {
  const { profile } = useSession();
  const orgId = profile?.organization_id ?? "";

  const { data: deadline, isLoading: loadingDeadline } = useQuery({
    queryKey: ["report", "deadline", orgId],
    queryFn: () => reportDeadlineCompliance(orgId),
    enabled: !!orgId,
  });
  const { data: confirmations, isLoading: loadingConfirmations } = useQuery({
    queryKey: ["report", "confirmations"],
    queryFn: () => reportConfirmations(),
  });
  const { data: byPerson, isLoading: loadingByPerson } = useQuery({
    queryKey: ["report", "by-person", orgId],
    queryFn: () => reportSchedulesByPerson(orgId),
    enabled: !!orgId,
  });
  const { data: approvalTime, isLoading: loadingApprovalTime } = useQuery({
    queryKey: ["report", "approval-time", orgId],
    queryFn: () => reportApprovalTime(orgId),
    enabled: !!orgId,
  });

  const chartData = (byPerson ?? []).slice(0, 10).map((p) => ({ name: p.fullName, escalas: p.count }));

  return (
    <ModulePage title="Relatórios" description="Indicadores operacionais do campo.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cumprimento de prazo (agendas)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDeadline && <LoadingState />}
            {deadline && (
              <p className="text-2xl font-semibold text-primary">
                {deadline.ratePercent}% <span className="text-sm font-normal text-muted-foreground">no prazo ({deadline.onTime}/{deadline.total})</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confirmações</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingConfirmations && <LoadingState />}
            {confirmations && (
              <div className="flex gap-6 text-sm">
                <span>Confirmadas: <strong>{confirmations.confirmed}</strong></span>
                <span>Recusadas: <strong>{confirmations.declined}</strong></span>
                <span>Pendentes: <strong>{confirmations.pending}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tempo médio de aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingApprovalTime && <LoadingState />}
            {approvalTime && (
              <p className="text-2xl font-semibold text-primary">
                {approvalTime.averageHours}h <span className="text-sm font-normal text-muted-foreground">({approvalTime.samples} escala(s) publicada(s))</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>Escalas por pessoa (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingByPerson && <LoadingState />}
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="escalas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
