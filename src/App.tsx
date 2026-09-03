import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/routes/auth";
import { AuthenticatedRoute } from "@/routes/_authenticated/route";
import { LoadingState } from "@/components/DataState";

const PainelPage = lazy(() => import("@/routes/_authenticated/painel").then((m) => ({ default: m.PainelPage })));
const AgendaGeralPage = lazy(() => import("@/routes/_authenticated/agenda-geral").then((m) => ({ default: m.AgendaGeralPage })));
const AvisosDaSemanaPage = lazy(() => import("@/routes/_authenticated/avisos-da-semana").then((m) => ({ default: m.AvisosDaSemanaPage })));
const AniversariantesPage = lazy(() => import("@/routes/_authenticated/aniversariantes").then((m) => ({ default: m.AniversariantesPage })));
const DecisoesPage = lazy(() => import("@/routes/_authenticated/decisoes").then((m) => ({ default: m.DecisoesPage })));
const ConfirmacoesPage = lazy(() => import("@/routes/_authenticated/confirmacoes").then((m) => ({ default: m.ConfirmacoesPage })));
const EventosPage = lazy(() => import("@/routes/_authenticated/eventos").then((m) => ({ default: m.EventosPage })));
const DepartamentosPage = lazy(() => import("@/routes/_authenticated/departamentos").then((m) => ({ default: m.DepartamentosPage })));
const IgrejasPage = lazy(() => import("@/routes/_authenticated/igrejas").then((m) => ({ default: m.IgrejasPage })));
const PessoasPage = lazy(() => import("@/routes/_authenticated/pessoas").then((m) => ({ default: m.PessoasPage })));
const UsuariosPage = lazy(() => import("@/routes/_authenticated/usuarios").then((m) => ({ default: m.UsuariosPage })));
const EscalasIndexPage = lazy(() => import("@/routes/_authenticated/escalas/index").then((m) => ({ default: m.EscalasIndexPage })));
const ScheduleEditorPage = lazy(() => import("@/routes/_authenticated/escalas/schedule-editor").then((m) => ({ default: m.ScheduleEditorPage })));
const AgendasPage = lazy(() => import("@/routes/_authenticated/agendas").then((m) => ({ default: m.AgendasPage })));
const NotificacoesPage = lazy(() => import("@/routes/_authenticated/notificacoes").then((m) => ({ default: m.NotificacoesPage })));
const NotificacoesInternasPage = lazy(() =>
  import("@/routes/_authenticated/notificacoes-internas").then((m) => ({ default: m.NotificacoesInternasPage })),
);
const AlterarSenhaPage = lazy(() => import("@/routes/_authenticated/alterar-senha").then((m) => ({ default: m.AlterarSenhaPage })));
const RelatoriosPage = lazy(() => import("@/routes/_authenticated/relatorios").then((m) => ({ default: m.RelatoriosPage })));
const AuditoriaPage = lazy(() => import("@/routes/_authenticated/auditoria").then((m) => ({ default: m.AuditoriaPage })));
const ConfiguracoesPage = lazy(() => import("@/routes/_authenticated/configuracoes").then((m) => ({ default: m.ConfiguracoesPage })));

function SuspensePage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<AuthenticatedRoute />}>
        <Route path="/painel" element={<SuspensePage><PainelPage /></SuspensePage>} />
        <Route path="/agenda-geral" element={<SuspensePage><AgendaGeralPage /></SuspensePage>} />
        <Route path="/avisos-da-semana" element={<SuspensePage><AvisosDaSemanaPage /></SuspensePage>} />
        <Route path="/aniversariantes" element={<SuspensePage><AniversariantesPage /></SuspensePage>} />
        <Route path="/decisoes" element={<SuspensePage><DecisoesPage /></SuspensePage>} />
        <Route path="/confirmacoes" element={<SuspensePage><ConfirmacoesPage /></SuspensePage>} />
        <Route path="/eventos" element={<SuspensePage><EventosPage /></SuspensePage>} />
        <Route path="/igrejas" element={<SuspensePage><IgrejasPage /></SuspensePage>} />
        <Route path="/departamentos" element={<SuspensePage><DepartamentosPage /></SuspensePage>} />
        <Route path="/pessoas" element={<SuspensePage><PessoasPage /></SuspensePage>} />
        <Route path="/usuarios" element={<SuspensePage><UsuariosPage /></SuspensePage>} />
        <Route path="/escalas" element={<SuspensePage><EscalasIndexPage /></SuspensePage>} />
        <Route path="/escalas/:scheduleId" element={<SuspensePage><ScheduleEditorPage /></SuspensePage>} />
        <Route path="/agendas" element={<SuspensePage><AgendasPage /></SuspensePage>} />
        <Route path="/notificacoes" element={<SuspensePage><NotificacoesPage /></SuspensePage>} />
        <Route path="/notificacoes-internas" element={<SuspensePage><NotificacoesInternasPage /></SuspensePage>} />
        <Route path="/alterar-senha" element={<SuspensePage><AlterarSenhaPage /></SuspensePage>} />
        <Route path="/relatorios" element={<SuspensePage><RelatoriosPage /></SuspensePage>} />
        <Route path="/auditoria" element={<SuspensePage><AuditoriaPage /></SuspensePage>} />
        <Route path="/configuracoes" element={<SuspensePage><ConfiguracoesPage /></SuspensePage>} />
      </Route>

      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}
