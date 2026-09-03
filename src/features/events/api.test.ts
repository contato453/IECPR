import { describe, expect, it } from "vitest";
import {
  isProjectedOccurrenceKey,
  isSundaySchoolEventType,
  makeProjectedOccurrenceKey,
  parseProjectedOccurrenceKey,
} from "@/features/events/api";

describe("chaves de ocorrência projetada (Bug #2)", () => {
  it("reconhece uma chave projetada e um uuid normal", () => {
    const key = makeProjectedOccurrenceKey("11111111-1111-1111-1111-111111111111", "2026-08-09");
    expect(isProjectedOccurrenceKey(key)).toBe(true);
    expect(isProjectedOccurrenceKey("11111111-1111-1111-1111-111111111111")).toBe(false);
  });

  it("faz o roundtrip de uma chave projetada", () => {
    const key = makeProjectedOccurrenceKey("abc-123", "2026-08-09");
    expect(parseProjectedOccurrenceKey(key)).toEqual({ recurrenceId: "abc-123", date: "2026-08-09" });
  });
});

describe("isSundaySchoolEventType", () => {
  it("identifica a Escola Bíblica Dominical mesmo com acentuação diferente", () => {
    expect(isSundaySchoolEventType({ name: "Escola Bíblica Dominical" })).toBe(true);
    expect(isSundaySchoolEventType({ name: "EBD" })).toBe(true);
    expect(isSundaySchoolEventType({ name: "Culto de Celebração" })).toBe(false);
  });
});
