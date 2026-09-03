import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { countUnreadNotifications } from "@/features/notifications/in-app";
import { useSession } from "@/hooks/useSession";

export function NotificationBell() {
  const { user } = useSession();
  const { data: unread = 0 } = useQuery({
    queryKey: ["in-app-notifications", "unread-count", user?.id],
    queryFn: () => countUnreadNotifications(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link to="/notificacoes-internas" title="Notificações">
        <Bell className="size-4" />
        {unread > 0 && (
          <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
