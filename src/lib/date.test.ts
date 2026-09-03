import { describe, expect, it } from "vitest";
import {
  addDaysDateOnly,
  calculateAge,
  dateOnlyToDate,
  diffInDays,
  firstDayOfMonth,
  formatDateBR,
  formatDayHeader,
  lastDayOfMonth,
  startOfWeekSunday,
  weekdayOf,
} from "@/lib/date";

describe("dateOnlyToDate", () => {
  it("nunca perde um dia por causa de UTC (Bug #1)", () => {
    // 2026-08-09 é um domingo. new Date("2026-08-09") isolado (UTC meia-noite)
    // viraria sábado em America/Sao_Paulo — dateOnlyToDate corrige isso.
    const date = dateOnlyToDate("2026-08-09");
    expect(date.getDate()).toBe(9);
    expect(date.getMonth()).toBe(7); // agosto = índice 7
  });
});

describe("formatDateBR / formatDayHeader", () => {
  it("formata uma data pura sem deslocar o dia", () => {
    expect(formatDateBR("2026-08-09")).toBe("09/08/2026");
  });

  it("monta o cabeçalho 'Dia N, dia da semana' corretamente", () => {
    // 2026-08-09 é domingo.
    expect(formatDayHeader("2026-08-09")).toBe("Dia 9, domingo");
  });
});

describe("weekdayOf / addDaysDateOnly / startOfWeekSunday", () => {
  it("calcula o dia da semana sem deslocamento de fuso", () => {
    expect(weekdayOf("2026-08-09")).toBe(0); // domingo
    expect(weekdayOf("2026-08-10")).toBe(1); // segunda
  });

  it("soma dias preservando o formato YYYY-MM-DD", () => {
    expect(addDaysDateOnly("2026-08-09", 7)).toBe("2026-08-16");
    expect(addDaysDateOnly("2026-01-30", 5)).toBe("2026-02-04");
  });

  it("encontra o domingo da semana", () => {
    expect(startOfWeekSunday("2026-08-12")).toBe("2026-08-09");
    expect(startOfWeekSunday("2026-08-09")).toBe("2026-08-09");
  });
});

describe("firstDayOfMonth / lastDayOfMonth", () => {
  it("calcula os limites do mês corretamente, inclusive fevereiro bissexto", () => {
    expect(firstDayOfMonth(2026, 8)).toBe("2026-08-01");
    expect(lastDayOfMonth(2026, 8)).toBe("2026-08-31");
    expect(lastDayOfMonth(2028, 2)).toBe("2028-02-29"); // bissexto
    expect(lastDayOfMonth(2026, 2)).toBe("2026-02-28");
  });
});

describe("calculateAge", () => {
  it("calcula idade completa antes e depois do aniversário", () => {
    expect(calculateAge("2000-08-15", "2026-08-14")).toBe(25);
    expect(calculateAge("2000-08-15", "2026-08-15")).toBe(26);
    expect(calculateAge("2000-08-15", "2026-08-16")).toBe(26);
  });
});

describe("diffInDays", () => {
  it("calcula a diferença em dias entre duas datas", () => {
    expect(diffInDays("2026-08-09", "2026-08-16")).toBe(7);
  });
});
