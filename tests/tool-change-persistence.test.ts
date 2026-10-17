import { describe, expect, it } from "vitest";
import { currentToolRecord, persistedToolLife } from "@/lib/live-gauge";

const articleTool = { toolId: "tool-a", name: "Fresa A" };
const changes = [
  { toolId: "tool-a", name: "Fresa A", occurredAt: 1, quantity: 1, unitCost: 12 },
];

function sessionView(rows: typeof changes, planned: number) {
  const used = rows.reduce((sum, row) => sum + row.quantity, 0);
  const current = currentToolRecord(rows, articleTool);
  return {
    toolId: current.toolId,
    tool: current.name,
    life: persistedToolLife(planned, used),
    history: [...rows].sort((left, right) => left.occurredAt - right.occurredAt),
    unitCost: rows[rows.length - 1]?.unitCost ?? null,
    articleToolId: articleTool.toolId,
  };
}

describe("persisted tool change", () => {
  it("records a change and reads it back from the same rows", () => {
    const before = sessionView([], 4);
    expect(before.life).toBe(100);
    expect(before.toolId).toBe("tool-a");
    const after = sessionView([...changes, { toolId: "tool-b", name: "Fresa B", occurredAt: 2, quantity: 1, unitCost: 12 }], 4);
    expect(after.toolId).toBe("tool-b");
    expect(after.tool).toBe("Fresa B");
    expect(after.life).toBe(50);
    expect(after.history).toHaveLength(2);
    expect(after.unitCost).toBe(12);
    expect(after.articleToolId).toBe("tool-a");
  });

  it("keeps the same tool, life and history after refresh, login and a second PC", () => {
    const rows = [...changes, { toolId: "tool-a", name: "Fresa A", occurredAt: 3, quantity: 1, unitCost: 9 }];
    const refresh = sessionView(rows, 4);
    const login = sessionView(rows, 4);
    const otherPc = sessionView(rows, 4);
    expect(login).toEqual(refresh);
    expect(otherPc).toEqual(refresh);
    expect(refresh.life).toBe(50);
    expect(refresh.history.map((row) => row.occurredAt)).toEqual([1, 3]);
  });
});
