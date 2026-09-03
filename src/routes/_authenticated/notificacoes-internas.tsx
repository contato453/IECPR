import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/DataState";
import { listInAppNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/in-app";
import { useSession } from "@/hooks/useSession";
import { formatShortDateWithWeekdayAndTime } from "@/lib/date";
import { cn } from "@/lib/utils";

export function NotificacoesInternasPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["in-app-notifications", user?.id],
    queryFn: () => listInAppNotifications(user!.id),
    enabled: !!user,
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] }),
  });

  return (
    <ModulePage
      title="Notificações internas"
      description="Avisos do sistema para você."
      actions={
        <Button variant="outline" onClick={() => markAllMutation.mutate()}>
          <CheckCheck /> Marcar todas como lidas
        </Button>
      }
    >
      {isLoading && <LoadingState />}
      {!isLoading && (!notifications || notifications.length === 0) && <EmptyState title="Nenhuma notificação" />}
      <div className="flex flex-col gap-2">
        {notifications?.map((n) => (
          <Card key={n.id} className={cn(!n.read_at && "border-primary/40 bg-primary/5")}>
            <CardContent className="flex items-start justify-between gap-3 pt-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read_at && <Badge variant="accent">Nova</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatShortDateWithWeekdayAndTime(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <Button variant="ghost" size="sm" onClick={() => markOneMutation.mutate(n.id)}>
                  Marcar como lida
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePage>
  );
}
