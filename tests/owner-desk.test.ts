import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ownerDesk } from "@/lib/owner-desk";

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pagesUnder(path);
    return name === "page.tsx" || name === "route.ts" ? [relative(process.cwd(), path).replaceAll("\\", "/")] : [];
  });
}

describe("owner desk", () => {
  it("shows margin, cost deviation and tool cost from the existing sources", () => {
    const desk = ownerDesk({
      departmentScores: [80, 60],
      averageCpk: 1.2,
      efficiencyPercent: 110,
      scrapPercent: 2,
      orders: [
        { id: "calm", part: "Calmo", actualMargin: 400, costDeviation: -20 },
        { id: "loss", part: "Perdita", actualMargin: -150, costDeviation: 80 },
      ],
      toolEvents: [
        { orderId: "loss", quantity: 2, unitCost: 12 },
        { orderId: "loss", quantity: 1, unitCost: 10 },
      ],
      activeAlerts: 2,
    });
    expect(desk.margin).toBe(250);
    expect(desk.costDeviation).toBe(60);
    expect(desk.toolCostImpact).toBe(34);
    expect(desk.departmentScore).toBe(70);
    expect(desk.problemOrders.map((order) => order.id)).toEqual(["loss"]);
    expect(desk.problemOrders[0]?.toolCostImpact).toBe(34);
    expect(desk.activeAlerts).toBe(2);
    expect(desk.averageCpk).toBe(1.2);
    expect(desk.efficiencyPercent).toBe(110);
    expect(desk.scrapPercent).toBe(2);
  });

  it("keeps department score, margin and cost deviation on one place in the owner home", () => {
    const source = readFileSync(join(process.cwd(), "src/app/dashboard/owner-home.tsx"), "utf8");
    expect(source.match(/process\.desk\.department/g)).toHaveLength(1);
    expect(source.includes("DepartmentGauge")).toBe(false);
    expect(source.includes("\"spc.averageCp\"")).toBe(false);
    expect(source.includes("spc.topRisks")).toBe(false);
    expect(source.includes("economy.margin")).toBe(true);
    expect(source.includes("economy.costDeviation")).toBe(true);
    expect(source.includes("toolHistory.articleCost")).toBe(true);
  });

  it("adds no owner routes, pages, or dashboards", () => {
    const pages = pagesUnder(join(process.cwd(), "src", "app"));
    expect(pages.filter((path) => path === "src/app/dashboard/page.tsx")).toEqual(["src/app/dashboard/page.tsx"]);
    expect(pages.some((path) => path.includes("/owner"))).toBe(false);
  });
});
