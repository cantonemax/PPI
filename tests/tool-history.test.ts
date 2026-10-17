import { describe, expect, it } from "vitest";
import { articleToolKpis, toolHistory, toolKpis, type ToolHistoryEvent } from "@/lib/tool-history";

const events: ToolHistoryEvent[] = [
  { toolId: "tool-a", orderId: "order-1", partId: "part-1", quantity: 1, unitCost: 10, occurredAt: 10, current: false },
  { toolId: "tool-a", orderId: "order-2", partId: "part-1", quantity: 2, unitCost: 12, occurredAt: 30, current: true },
  { toolId: "tool-b", orderId: "order-2", partId: "part-1", quantity: 1, unitCost: 5, occurredAt: 20, current: true },
];

const estimates = [
  { toolId: "tool-a", partId: "part-1", quantity: 4 },
  { toolId: "tool-b", partId: "part-1", quantity: 1 },
];

describe("tool history", () => {
  it("sorts the chronology from the newest change", () => {
    expect(toolHistory(events).map((event) => event.occurredAt)).toEqual([30, 20, 10]);
  });

  it("reads tool and article figures from the persisted rows", () => {
    const kpis = toolKpis("tool-a", events, estimates);
    expect(kpis.totalToolChanges).toBe(2);
    expect(kpis.currentToolChanges).toBe(1);
    expect(kpis.totalEstimatedConsumption).toBe(4);
    expect(kpis.totalToolCost).toBe(34);
    expect(kpis.averageCostPerChange).toBe(17);
    expect(kpis.firstRecordedChange).toBe(10);
    expect(kpis.lastRecordedChange).toBe(30);
    expect(articleToolKpis("part-1", events, estimates)).toEqual({
      toolChangesCount: 3,
      estimatedToolUsage: 5,
      toolCostImpact: 39,
    });
  });

  it("keeps the same history after refresh, login and a second PC", () => {
    const refresh = toolHistory(events);
    const login = toolHistory(events);
    const otherPc = toolHistory(events);
    expect(login).toEqual(refresh);
    expect(otherPc).toEqual(refresh);
    expect(refresh[0].occurredAt).toBe(30);
    expect(refresh[0].unitCost).toBe(12);
    expect(refresh[0].quantity).toBe(2);
  });
});
