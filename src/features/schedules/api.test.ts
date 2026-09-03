import { describe, expect, it } from "vitest";
import { computeOccurrenceStatus, findConflicts } from "@/features/schedules/api";
import type { EventType, ScheduleItem } from "@/types/domain";

const preacherId = "11111111-1111-1111-1111-111111111111";
const leaderId = "22222222-2222-2222-2222-222222222222";

let nextId = 0;

function makeItem(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: `item-${(nextId += 1)}`,
    schedule_id: "sched-1",
    event_id: "event-1",
    kind: "leader",
    person_id: null,
    department_id: null,
    opportunity_label: null,
    notes: null,
    sort_order: 0,
    ...overrides,
  };
}

describe("computeOccurrenceStatus", () => {
  it("marca pendente quando falta dirigente ou pregador", () => {
    const status = computeOccurrenceStatus(undefined, [makeItem({ kind: "leader", person_id: leaderId })]);
    expect(status.hasLeader).toBe(true);
    expect(status.hasPreacher).toBe(false);
    expect(status.isComplete).toBe(false);
  });

  it("marca completa quando há dirigente e pregador", () => {
    const status = computeOccurrenceStatus(undefined, [
      makeItem({ kind: "leader", person_id: leaderId }),
      makeItem({ kind: "preacher", person_id: preacherId }),
    ]);
    expect(status.isComplete).toBe(true);
  });

  it("Escola Bíblica Dominical nunca entra na lógica de escala (regra 6.5)", () => {
    const ebd: EventType = {
      id: "type-1",
      organization_id: "org-1",
      name: "Escola Bíblica Dominical",
      allows_lords_supper: false,
      default_duration_minutes: 60,
      creation_permission: null,
      active: true,
      created_at: "",
      updated_at: "",
      deleted_at: null,
    };
    const status = computeOccurrenceStatus(ebd, []);
    expect(status.isExempt).toBe(true);
    expect(status.isComplete).toBe(true);
  });
});

describe("findConflicts", () => {
  it("nunca acusa conflito — decisão de produto: sem trava de igreja, qualificação ou acúmulo de função", () => {
    const items = [
      makeItem({ kind: "leader", person_id: leaderId }),
      makeItem({ kind: "preacher", person_id: leaderId }), // mesma pessoa dirige e prega
    ];
    expect(findConflicts(items)).toEqual(new Set());
  });
});
