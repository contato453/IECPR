import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/assets/Logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/hooks/useSession";
import { isNavItemVisible, navigationGroups } from "@/app/navigation";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, profileKeys } = useSession();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 py-5">
        <Logo className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-semibold">IECPR</p>
          <p className="truncate text-xs text-sidebar-foreground/70">Gestão ministerial</p>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setDrawerOpen(false)}>
            <X />
          </Button>
        )}
      </div>
      <Separator className="bg-sidebar-border" />
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => isNavItemVisible(item, profileKeys));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <Separator className="bg-sidebar-border" />
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? "Usuário"}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{profile?.email}</p>
        </div>
        <NotificationBell />
        <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout} title="Sair">
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      {!isMobile && <aside className="w-64 shrink-0 iecpr-no-print">{sidebarContent}</aside>}

      {isMobile && drawerOpen && (
        <div className="fixed inset-0 z-40 flex iecpr-no-print">
          <div className="w-72 shadow-xl">{sidebarContent}</div>
          <button
            className="flex-1 bg-foreground/40"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        {!isMobile && (
          <header className="iecpr-no-print flex h-11 items-center justify-center border-b border-border bg-secondary px-4">
            <p className="font-serif text-sm italic text-secondary-foreground">
              &ldquo;O Senhor dos Exércitos está conosco; o Deus de Jacó é o nosso refúgio&rdquo; — Salmos 46:11
            </p>
          </header>
        )}
        {isMobile && (
          <header className="iecpr-no-print flex h-14 items-center gap-3 border-b border-border bg-card px-3">
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}>
              <Menu />
            </Button>
            <div className="flex items-center gap-2">
              <Logo className="size-7" />
              <span className="font-serif text-sm font-semibold">IECPR</span>
            </div>
          </header>
        )}
        <main className="flex-1 bg-background p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
