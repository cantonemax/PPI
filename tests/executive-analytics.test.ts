import { describe, expect, it } from "vitest";
import { availableYears, executiveLayer, growthSinceLaunch, readRange, scopeCompanies, type ExecutiveRange } from "@/lib/executive-analytics";
import type { DeskCompany } from "@/lib/platform-analytics";

function company(patch: Partial<DeskCompany>): DeskCompany {
  return {
    id: "c",
    name: "Alfa",
    deletedAt: null,
    closedAt: null,
    contractStatus: "ACTIVE",
    plan: "CORE",
    billingCycle: "MONTHLY",
    region: "Piemonte",
    province: "Torino",
    country: "Italia",
    monthlyRevenue: 100,
    annualRevenue: 1200,
    renewalAt: null,
    expiresAt: null,
    lastPaymentAt: null,
    activatedAt: new Date("2026-10-01T00:00:00.000Z"),
    customerSince: new Date("2026-10-01T00:00:00.000Z"),
    ...patch,
  };
}

describe("executive analytics", () => {
  const now = new Date("2026-10-16T00:00:00.000Z");

  it("keeps the current book for the last 12 months", () => {
    const rows = [company({ id: "a" }), company({ id: "b", customerSince: new Date("2020-01-01T00:00:00.000Z"), activatedAt: new Date("2020-01-01T00:00:00.000Z") })];
    expect(scopeCompanies(rows, "last12", null, now)).toHaveLength(2);
    expect(readRange("nope")).toBe("last12");
    expect(readRange("sinceLaunch")).toBe("sinceLaunch");
  });

  it("scopes shorter windows and calendar years from existing stamps", () => {
    const recent = company({ id: "recent" });
    const old = company({ id: "old", customerSince: new Date("2025-01-01T00:00:00.000Z"), activatedAt: new Date("2025-01-01T00:00:00.000Z"), lastPaymentAt: new Date("2025-01-01T00:00:00.000Z") });
    expect(scopeCompanies([recent, old], "last30", null, now).map((row) => row.id)).toEqual(["recent"]);
    expect(scopeCompanies([recent, old], "previousYear" as ExecutiveRange, null, now).map((row) => row.id)).toEqual(["old"]);
    expect(scopeCompanies([recent, old], "last12", 2025, now).map((row) => row.id)).toEqual(["old"]);
    expect(availableYears([recent, old])).toEqual([2025, 2026]);
  });

  it("builds lifetime kpis without dropping historical companies", () => {
    const rows = [
      company({ id: "live", name: "Viva", annualRevenue: 5000, monthlyRevenue: 400, plan: "CORE", region: "Lombardia", province: "Milano", country: "Italia" }),
      company({ id: "gone", name: "Persa", annualRevenue: 9000, deletedAt: now, plan: "ENTERPRISE" }),
      company({ id: "shut", name: "Chiusa", monthlyRevenue: 0, annualRevenue: 100, closedAt: now, contractStatus: "EXPIRED", activatedAt: new Date("2024-01-01T00:00:00.000Z"), customerSince: new Date("2024-01-01T00:00:00.000Z") }),
      company({ id: "pause", name: "Sospesa", closedAt: now, contractStatus: "SUSPENDED", annualRevenue: 50, monthlyRevenue: 0 }),
    ];
    const layer = executiveLayer(rows, now, "Altro");
    expect(layer.lifetime.totalRevenue).toBe(14150);
    expect(layer.lifetime.acquired).toBe(4);
    expect(layer.lifetime.active).toBe(1);
    expect(layer.lifetime.lost).toBe(2);
    expect(layer.lifetime.averageValue).toBe(4950);
    expect(layer.lifetime.bestCustomer).toBe("Viva");
    expect(layer.lifetime.bestRegion).toBe("Lombardia");
    expect(layer.lifetime.popularPlan).toBe("CORE");
    expect(layer.summary.nextRenewal).toBeNull();
  });

  it("plots cumulative revenue and customers from the first activation", () => {
    const points = growthSinceLaunch([
      company({ annualRevenue: 100, customerSince: new Date("2024-05-01T00:00:00.000Z"), activatedAt: new Date("2024-05-01T00:00:00.000Z") }),
      company({ id: "b", annualRevenue: 50, customerSince: new Date("2025-05-01T00:00:00.000Z"), activatedAt: new Date("2025-05-01T00:00:00.000Z") }),
    ], now);
    expect(points.map((point) => point.revenue)).toEqual([100, 150, 150]);
    expect(points.map((point) => point.customers)).toEqual([1, 2, 2]);
    expect(points[0]?.label).toBe("2024");
  });
});
