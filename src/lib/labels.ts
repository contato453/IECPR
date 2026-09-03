/**
 * Tradução centralizada de enums técnicos (inglês) para rótulos em português.
 * Nenhuma tela deve exibir uma chave técnica diretamente — sempre passar
 * pelo helper correspondente aqui.
 */
import type {
  AccessProfile,
  ConfirmationStatus,
  MinisterialQualification,
  NotificationChannel,
  NotificationStatus,
  RecurrenceFrequency,
  ScheduleItemKind,
  WorkflowStatus,
} from "@/types/domain";

export const accessProfileLabels: Record<AccessProfile, string> = {
  pastor_admin: "Pastor Administrador",
  church_leader: "Líder de Congregação",
  department_leader: "Líder de Departamento",
  ministerial_viewer: "Acesso Ministerial",
};

export const qualificationLabels: Record<MinisterialQualification, string> = {
  pastor_president: "Pastor Presidente",
  assistant_pastor: "Pastor Auxiliar",
  pastor: "Pastor",
  evangelist: "Evangelista",
  presbyter: "Presbítero",
  deacon: "Diácono",
  missionary: "Missionário",
  cooperator: "Cooperador",
  sunday_school_teacher: "Professor de EBD",
  member: "Membro",
};

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  under_review: "Em análise",
  approved: "Aprovada",
  returned: "Devolvida",
  rejected: "Rejeitada",
  published: "Publicada",
  cancelled: "Cancelada",
};

export const scheduleItemKindLabels: Record<ScheduleItemKind, string> = {
  leader: "Dirigente",
  preacher: "Pregador",
  opportunity: "Oportunidade",
};

export const confirmationStatusLabels: Record<ConfirmationStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  replaced: "Substituído",
};

export const recurrenceFrequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  manual: "Manual",
};

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export const situationLabels: Record<string, string> = {
  ativo: "Ativo",
  desligado: "Desligado",
  excluído: "Excluído",
  falecido: "Falecido",
  transferido: "Transferido",
};

export const weekdayLabels = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function labelOrValue<T extends string>(map: Record<T, string>, value: T | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}
