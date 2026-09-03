import { describe, expect, it } from "vitest";
import { defaultDeadline, isLate } from "@/features/agendas/api";

describe("defaultDeadline", () => {
  it("cai no sábado anterior às 18h, no fuso America/Sao_Paulo", () => {
    // 2026-08-09 é domingo → semana começa nesse dia; sábado anterior é 2026-08-08.
    const deadline = defaultDeadline("2026-08-09");
    // 18h em UTC-3 = 21h UTC.
    expect(deadline.toISOString()).toBe("2026-08-08T21:00:00.000Z");
  });
});

describe("isLate", () => {
  it("considera atrasada uma agenda com prazo vencido e ainda não aprovada", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    expect(isLate({ deadline_at: past, status: "draft" })).toBe(true);
  });

  it("não considera atrasada uma agenda já aprovada ou publicada, mesmo com prazo vencido", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    expect(isLate({ deadline_at: past, status: "approved" })).toBe(false);
    expect(isLate({ deadline_at: past, status: "published" })).toBe(false);
  });

  it("não considera atrasada uma agenda com prazo futuro", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isLate({ deadline_at: future, status: "draft" })).toBe(false);
  });
});
