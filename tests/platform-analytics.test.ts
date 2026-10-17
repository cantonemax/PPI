import { describe, expect, it } from "vitest";
import { businessDesk, type DeskCompany } from "@/lib/platform-analytics";

function company(patch: Partial<DeskCompany>): DeskCompany {
  return {
    id: "c",
    name: "Alfa",
    deletedAt: null,
    closedAt: null,
    contractStatus: "ACTIVE",
    plan: "BASE",
    billingCycle: "MONTHLY",
    region: "Piemonte",
    province: "Torino",
    country: "Italia",
    monthlyRevenue: 100,
    annualRevenue: 1200,
    renewalAt: null,
    expiresAt: null,
    lastPaymentAt: null,
    activatedAt: null,
    customerSince: null,
    ...patch,
  };
}

describe("business desk", () => {
  const now = new Date("2026-10-16T00:00:00.000Z");

  it("aggregates revenue and ignores deleted companies", () => {
    const view = businessDesk([
      company({ id: "a" }),
      company({ id: "b", contractStatus: "TRIAL", monthlyRevenue: 40, annualRevenue: 400 }),
      company({ id: "c", contractStatus: "SUSPENDED", closedAt: now, monthlyRevenue: 10, annualRevenue: 80 }),
      company({ id: "d", deletedAt: now, monthlyRevenue: 999, annualRevenue: 9999 }),
    ], now, "month", "Altro");
    expect(view.kpis.active).toBe(1);
    expect(view.kpis.trial).toBe(1);
    expect(view.kpis.suspended).toBe(1);
    expect(view.kpis.monthRevenue).toBe(150);
    expect(view.kpis.yearRevenue).toBe(1680);
    expect(view.kpis.mrr).toBe(150);
    expect(view.kpis.arr).toBe(1800);
    expect(view.hasRevenue).toBe(true);
  });

  it("aggregates plans by count and by revenue", () => {
    const view = businessDesk([
      company({ id: "a", plan: "BASE", annualRevenue: 1000 }),
      company({ id: "b", plan: "PREMIUM", annualRevenue: 5000 }),
      company({ id: "c", plan: "BASE", annualRevenue: 200 }),
    ], now, "month", "Altro", ["FREE", "BASE", "MEDIUM", "PREMIUM"]);
    expect(view.plans.customers.find((slice) => slice.label === "BASE")?.value).toBe(2);
    expect(view.plans.revenue.find((slice) => slice.label === "PREMIUM")?.value).toBe(5000);
    expect(view.plans.revenue.find((slice) => slice.label === "FREE")?.value).toBe(0);
  });

  it("aggregates region, province and country", () => {
    const view = businessDesk([
      company({ id: "a", region: "Piemonte", province: "Torino", country: "Italia", annualRevenue: 1000, contractStatus: "ACTIVE" }),
      company({ id: "b", region: "Lombardia", province: "Milano", country: "Italia", annualRevenue: 3000, contractStatus: "TRIAL" }),
      company({ id: "c", region: "", province: "", country: "", annualRevenue: 0, contractStatus: "SUSPENDED", closedAt: now }),
    ], now, "month", "Altro");
    expect(view.regions.customers.map((slice) => slice.label)).toEqual(["Piemonte", "Lombardia", "Altro"]);
    expect(view.regions.revenue[0]).toEqual({ label: "Lombardia", value: 3000 });
    expect(view.regions.active.map((slice) => slice.label)).toEqual(["Piemonte"]);
    expect(view.provinces.customers[0]?.label).toBe("Torino");
    expect(view.provinces.revenue[0]).toEqual({ label: "Milano", value: 3000 });
    expect(view.countries.customers.find((slice) => slice.label === "Italia")?.value).toBe(2);
    expect(view.countries.revenue.find((slice) => slice.label === "Italia")?.value).toBe(4000);
  });

  it("ranks top customers by annual revenue", () => {
    const view = businessDesk([
      company({ id: "a", name: "Beta", annualRevenue: 100 }),
      company({ id: "b", name: "Alfa", annualRevenue: 900, renewalAt: new Date("2026-11-01T00:00:00.000Z") }),
      company({ id: "c", name: "Cancellata", annualRevenue: 5000, deletedAt: now }),
    ], now, "month", "Altro");
    expect(view.top.map((row) => row.name)).toEqual(["Alfa", "Beta"]);
    expect(view.top[0]?.rank).toBe(1);
    expect(view.top[0]?.annualRevenue).toBe(900);
    expect(view.top[0]?.renewalAt?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("normalizes yearly contracts into MRR and ARR", () => {
    const view = businessDesk([
      company({ id: "a", billingCycle: "YEARLY", monthlyRevenue: 0, annualRevenue: 1200 }),
      company({ id: "b", billingCycle: "MONTHLY", monthlyRevenue: 0, annualRevenue: 600 }),
    ], now, "month", "Altro");
    expect(view.kpis.mrr).toBe(150);
    expect(view.kpis.arr).toBe(1800);
  });

  it("keeps only the first ten customers in rank order", () => {
    const rows = Array.from({ length: 12 }, (_, index) => company({
      id: `c${index}`,
      name: `Cliente ${String(index).padStart(2, "0")}`,
      annualRevenue: index * 100,
    }));
    const view = businessDesk(rows, now, "month", "Altro");
    expect(view.top).toHaveLength(10);
    expect(view.top[0]).toMatchObject({ rank: 1, name: "Cliente 11", annualRevenue: 1100 });
    expect(view.top[2]?.rank).toBe(3);
    expect(view.top[9]).toMatchObject({ rank: 10, name: "Cliente 02" });
    expect(view.top.some((row) => row.name === "Cliente 00")).toBe(false);
  });

  it("calculates renewals and the last 12 months", () => {
    const view = businessDesk([
      company({ id: "a", renewalAt: new Date("2026-11-01T00:00:00.000Z"), lastPaymentAt: new Date("2026-03-10T00:00:00.000Z"), monthlyRevenue: 80 }),
      company({ id: "b", name: "Gamma", renewalAt: new Date("2026-12-01T00:00:00.000Z"), contractStatus: "EXPIRED", expiresAt: new Date("2026-09-01T00:00:00.000Z"), monthlyRevenue: 0, annualRevenue: 0 }),
      company({ id: "c", name: "Sospesa", contractStatus: "SUSPENDED", closedAt: now, monthlyRevenue: 0, annualRevenue: 0 }),
    ], now, "month", "Altro");
    expect(view.renewals.next30.map((row) => row.id)).toEqual(["a"]);
    expect(view.renewals.next60.map((row) => row.id)).toEqual(["a", "b"]);
    expect(view.renewals.expired.map((row) => row.id)).toEqual(["b"]);
    expect(view.renewals.suspended.map((row) => row.id)).toEqual(["c"]);
    expect(view.kpis.renewals).toBe(1);
    expect(view.series).toHaveLength(12);
    expect(view.series.find((point) => point.label.startsWith("mar"))?.value).toBe(80);
    expect(view.series.at(-1)?.label.startsWith("ott")).toBe(true);
  });

  it("reports the empty revenue state", () => {
    const view = businessDesk([
      company({ monthlyRevenue: 0, annualRevenue: 0 }),
    ], now, "month", "Altro");
    expect(view.hasRevenue).toBe(false);
  });
});
