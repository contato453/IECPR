import { useQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpcomingServices } from "@/components/UpcomingServices";
import { LoadingState } from "@/components/DataState";
import { getMinisterialBoardCounts, listChurches, listDepartments, listPeople, listRecentLogins } from "@/features/core/api";
import { listSchedules } from "@/features/schedules/api";
import { useSession } from "@/hooks/useSession";
import { diffInDays, formatShortDateWithWeekdayAndTime } from "@/lib/date";
import { qualificationLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MinisterialBoardCounts } from "@/features/core/api";

const boardOrder: (keyof MinisterialBoardCounts)[] = [
  "pastor_president",
  "assistant_pastor",
  "pastor",
  "presbyter",
  "evangelist",
  "deacon",
  "missionary",
  "cooperator",
  "member",
];

export function PainelPage() {
  const { profile } = useSession();

  const { data: board, isLoading: loadingBoard } = useQuery({ queryKey: ["ministerial-board"], queryFn: getMinisterialBoardCounts });
  const { data: people = [] } = useQuery({ queryKey: ["people", "all-for-count"], queryFn: () => listPeople({ includeInactive: false }) });
  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });
  const { data: departments = [] } = useQuery({ queryKey: ["departments", "all"], queryFn: () => listDepartments() });
  const { data: schedules = [] } = useQuery({ queryKey: ["schedules", "all-for-count"], queryFn: () => listSchedules() });
  const { data: recentLogins, isLoading: loadingLogins } = useQuery({ queryKey: ["recent-logins"], queryFn: () => listRecentLogins(10) });

  return (
    <ModulePage title="Painel" description={`Bem-vindo(a), ${profile?.full_name ?? ""}.`}>
      <div className="flex flex-col gap-6">
        {/* 1. Quadro Ministerial */}
        <Card>
          <CardHeader>
            <CardTitle>Quadro Ministerial</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBoard && <LoadingState />}
            {board && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {boardOrder.map((key) => (
                  <div key={key} className="rounded-lg border border-border p-3 text-center">
                    <p className="font-serif text-2xl font-semibold text-primary">{board[key]}</p>
                    <p className="text-xs text-muted-foreground">{qualificationLabels[key]}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Cards de indicadores */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <IndicatorCard label="Membros" value={people.length} />
          <IndicatorCard label="Igrejas" value={churches.length} />
          <IndicatorCard label="Departamentos" value={departments.length} />
          <IndicatorCard label="Total de escalas" value={schedules.length} />
          <IndicatorCard label="Decisões nos últimos 30 dias" value={8} disabled />
        </div>

        {/* 3. Próximos cultos */}
        <UpcomingServices />

        {/* 4. Últimos acessos */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos acessos dos usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLogins && <LoadingState />}
            <div className="flex flex-col divide-y divide-border">
              {recentLogins?.map((login) => {
                const daysAgo = diffInDays(login.lastLogin, new Date());
                const stale = daysAgo > 15;
                return (
                  <div key={login.userId} className={cn("flex items-center justify-between py-2", stale && "text-destructive")}>
                    <span className="font-medium">{login.fullName}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {formatShortDateWithWeekdayAndTime(login.lastLogin)}
                      {stale && <Badge variant="destructive">+15 dias sem logar</Badge>}
                    </span>
                  </div>
                );
              })}
              {recentLogins?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}

function IndicatorCard({ label, value, disabled }: { label: string; value: number; disabled?: boolean }) {
  return (
    <Card className={cn(disabled && "opacity-90")}>
      <CardContent className="pt-6 text-center">
        <p className="font-serif text-3xl font-semibold text-primary">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
