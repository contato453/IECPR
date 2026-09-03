import type { WorkflowStatus } from "@/types/domain";

/**
 * Máquina de estados do fluxo de aprovação (escalas e agendas departamentais).
 *
 *   draft ──enviar──▶ submitted ──iniciar análise──▶ under_review
 *                        │                                │
 *                        ├──aprovar──▶ approved ──publicar──▶ published
 *                        ├──devolver─▶ returned ──reenviar──▶ submitted
 *                        └──rejeitar─▶ rejected ──reabrir───▶ draft
 *   approved/published ──cancelar──▶ cancelled ──reabrir──▶ draft
 *
 * Nota de produto: a UI rotula a transição de aprovação como "Completar
 * escala" (não "Aprovar"), porque o vocabulário de workflow formal confundia
 * os usuários (decisão de produto #10). A máquina de estados abaixo continua
 * completa; é só o rótulo do botão que muda — ver `labels.ts`.
 */

export interface WorkflowTransition {
  from: WorkflowStatus;
  to: WorkflowStatus;
  action: string;
  /** Transições visíveis somente para o pastor administrador. */
  admin?: boolean;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  { from: "draft", to: "submitted", action: "Enviar" },
  { from: "submitted", to: "under_review", action: "Iniciar análise" },
  { from: "under_review", to: "approved", action: "Completar escala", admin: true },
  { from: "under_review", to: "returned", action: "Devolver", admin: true },
  { from: "under_review", to: "rejected", action: "Rejeitar", admin: true },
  { from: "returned", to: "submitted", action: "Reenviar" },
  { from: "rejected", to: "draft", action: "Reabrir", admin: true },
  { from: "approved", to: "published", action: "Publicar", admin: true },
  { from: "approved", to: "cancelled", action: "Cancelar", admin: true },
  { from: "published", to: "cancelled", action: "Cancelar", admin: true },
  { from: "cancelled", to: "draft", action: "Reabrir", admin: true },
];

/** Itens só são editáveis em rascunho e devolvida — mas ver nota abaixo. */
export const EDITABLE_STATUSES: WorkflowStatus[] = ["draft", "returned"];

/**
 * Na prática, o sistema permite edição livre em qualquer status não-cancelado
 * (Bug #5 corrigido: `validate_schedule_item()` deixou de travar edição fora
 * de rascunho). `EDITABLE_STATUSES` documenta a intenção formal do fluxo;
 * `isEditableInPractice` reflete o comportamento real habilitado na UI.
 */
export function isEditableInPractice(status: WorkflowStatus): boolean {
  return status !== "cancelled";
}

export function availableTransitions(status: WorkflowStatus, isAdmin: boolean): WorkflowTransition[] {
  return WORKFLOW_TRANSITIONS.filter((t) => t.from === status && (!t.admin || isAdmin));
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus, isAdmin: boolean): boolean {
  return WORKFLOW_TRANSITIONS.some((t) => t.from === from && t.to === to && (!t.admin || isAdmin));
}
