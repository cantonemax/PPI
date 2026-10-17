import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { productionDesk, type ProductionMachine } from "@/lib/production-desk";

function machine(patch: Partial<ProductionMachine>): ProductionMachine {
  return {
    id: "m",
    name: "Macchina",
    orderId: "order",
    part: "Pezzo",
    stopped: false,
    processRisk: "none",
    controlOverdue: false,
    toolLife: 80,
    toolId: "tool",
    toolName: "Fresa",
    scrapPercent: 0,
    good: 50,
    target: 100,
    scrapPieces: 0,
    actualTime: 10,
    estimatedTime: 10,
    ...patch,
  };
}

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pagesUnder(path);
    return name === "page.tsx" || name === "route.ts" ? [relative(process.cwd(), path).replaceAll("\\", "/")] : [];
  });
}

describe("production desk", () => {
  it("puts a stopped machine in the top section", () => {
    const desk = productionDesk({
      machines: [machine({ id: "run", name: "A", stopped: false }), machine({ id: "stop", name: "B", orderId: "o2", stopped: true })],
      orders: [],
      departmentScores: [80],
    });
    expect(desk.actionMachines[0]?.id).toBe("stop");
    expect(desk.alerts.critical.some((alert) => alert.machineId === "stop" && alert.code === "stopped")).toBe(true);
  });

  it("puts a tool replacement in the top section", () => {
    const desk = productionDesk({
      machines: [machine({ id: "worn", toolLife: 12 })],
      orders: [],
      departmentScores: [],
    });
    expect(desk.actionMachines.some((row) => row.id === "worn" && row.reason === "toolReplace")).toBe(true);
    expect(desk.alerts.high.some((alert) => alert.code === "toolReplace")).toBe(true);
  });

  it("ranks a high scrap machine before a normal machine", () => {
    const desk = productionDesk({
      machines: [
        machine({ id: "calm", name: "Calma", scrapPercent: 0, scrapPieces: 0, good: 100 }),
        machine({ id: "scrap", name: "Scarto", orderId: "o2", scrapPercent: 8, scrapPieces: 8, good: 92 }),
      ],
      orders: [],
      departmentScores: [80, 60],
    });
    expect(desk.machines.map((row) => row.id)).toEqual(["scrap", "calm"]);
    expect(desk.actionMachines.map((row) => row.id)).toEqual(["scrap"]);
    expect(desk.status.departmentScore).toBe(70);
    expect(desk.status.progress).not.toBeNull();
    expect(desk.status.efficiency).not.toBeNull();
    expect(desk.status.scrap).not.toBeNull();
  });

  it("lists a late order in delivery risk", () => {
    const desk = productionDesk({
      machines: [],
      orders: [{ id: "late", part: "Albero", machineName: "Torno", daysRemaining: -2, band: "low" }],
      departmentScores: [],
    });
    expect(desk.delivery.late.map((order) => order.id)).toEqual(["late"]);
    expect(desk.alerts.critical.some((alert) => alert.orderId === "late" && alert.code === "late")).toBe(true);
  });

  it("adds no production routes, pages, or dashboards", () => {
    const pages = pagesUnder(join(process.cwd(), "src", "app"));
    const processPages = pages.filter((path) => path.includes("/dashboard/process/")).sort();
    expect(processPages).toEqual([
      "src/app/dashboard/process/machines/[machineId]/page.tsx",
      "src/app/dashboard/process/page.tsx",
    ]);
    expect(pages.some((path) => path.includes("/dashboard/production"))).toBe(false);
    expect(pages.filter((path) => path.endsWith("/route.ts") && path.includes("/process/"))).toEqual([]);
  });
});
