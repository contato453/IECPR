import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  Megaphone,
  Cake,
  Scale,
  CalendarCheck2,
  CalendarClock,
  Building2,
  Users2,
  UserRound,
  ShieldCheck,
  ClipboardList,
  ListChecks,
  Bell,
  BellDot,
  KeyRound,
  BarChart3,
  History,
  Settings,
  Church,
} from "lucide-react";
import type { AccessProfile } from "@/types/domain";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Se vazio, todos os perfis autenticados enxergam o item. */
  allow?: AccessProfile[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { label: "Painel", to: "/painel", icon: LayoutDashboard },
      { label: "Agenda geral", to: "/agenda-geral", icon: CalendarDays },
      { label: "Avisos da semana", to: "/avisos-da-semana", icon: Megaphone },
      { label: "Aniversariantes", to: "/aniversariantes", icon: Cake },
      { label: "Decisão e Reconciliação", to: "/decisoes", icon: Scale },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Igrejas", to: "/igrejas", icon: Church },
      { label: "Departamentos", to: "/departamentos", icon: Building2 },
      { label: "Membros", to: "/pessoas", icon: Users2 },
      {
        label: "Usuários e acessos",
        to: "/usuarios",
        icon: ShieldCheck,
        allow: ["pastor_admin"],
      },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Eventos", to: "/eventos", icon: CalendarClock },
      { label: "Controle de Escalas", to: "/escalas", icon: ClipboardList },
      { label: "Confirmações", to: "/confirmacoes", icon: CalendarCheck2 },
      { label: "Agendas departamentais", to: "/agendas", icon: ListChecks },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Notificações", to: "/notificacoes", icon: Bell },
      { label: "Notificações internas", to: "/notificacoes-internas", icon: BellDot },
      { label: "Relatórios", to: "/relatorios", icon: BarChart3 },
      { label: "Auditoria", to: "/auditoria", icon: History, allow: ["pastor_admin"] },
      { label: "Configurações", to: "/configuracoes", icon: Settings, allow: ["pastor_admin"] },
      { label: "Alterar senha", to: "/alterar-senha", icon: KeyRound },
    ],
  },
];

export function isNavItemVisible(item: NavItem, profiles: AccessProfile[]): boolean {
  if (!item.allow || item.allow.length === 0) return true;
  return item.allow.some((p) => profiles.includes(p));
}

export const currentUserIcon = UserRound;
