import { describe, expect, it } from "vitest";
import { availableTransitions, canTransition, isEditableInPractice } from "@/features/workflow";

describe("workflow", () => {
  it("permite enviar um rascunho e nada mais, para um usuário comum", () => {
    const transitions = availableTransitions("draft", false);
    expect(transitions.map((t) => t.to)).toEqual(["submitted"]);
  });

  it("some transições de aprovação só aparecem para o administrador", () => {
    const asUser = availableTransitions("under_review", false);
    const asAdmin = availableTransitions("under_review", true);
    expect(asUser).toHaveLength(0);
    expect(asAdmin.map((t) => t.to).sort()).toEqual(["approved", "rejected", "returned"].sort());
  });

  it("não permite pular etapas fora da máquina de estados", () => {
    expect(canTransition("draft", "published", true)).toBe(false);
    expect(canTransition("approved", "published", true)).toBe(true);
    expect(canTransition("approved", "published", false)).toBe(false); // publicar é admin-only
  });

  it("cancelar e reabrir são ações de administrador", () => {
    expect(canTransition("published", "cancelled", false)).toBe(false);
    expect(canTransition("published", "cancelled", true)).toBe(true);
    expect(canTransition("cancelled", "draft", true)).toBe(true);
  });

  it("qualquer status não-cancelado é editável na prática (Bug #5)", () => {
    expect(isEditableInPractice("draft")).toBe(true);
    expect(isEditableInPractice("published")).toBe(true);
    expect(isEditableInPractice("cancelled")).toBe(false);
  });
});
