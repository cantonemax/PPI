import { describe, expect, it } from "vitest";
import { canClearDemoDataset, commercialCompanies, demoRecordToUpdate, preservedNotes } from "@/lib/analytics-test-companies";
import { executiveLayer, growthSinceLaunch } from "@/lib/executive-analytics";
import { businessDesk, type DeskCompany } from "@/lib/platform-analytics";

function company(patch: Partial<DeskCompany> & { notes?: string | null }): DeskCompany & { notes?: string | null } {
  return {
    id: "a",
    name: "Azienda A",
    deletedAt: null,
    closedAt: null,
    contractStatus: "ACTIVE",
    plan: "CORE",
    billingCycle: "MONTHLY",
    region: "Piemonte",
    province: "Torino",
    country: "Italia",
    monthlyRevenue: 100,
    annualRevenue: 10000,
    renewalAt: null,
    expiresAt: null,
    lastPaymentAt: null,
    activatedAt: new Date("2024-05-01T00:00:00.000Z"),
    customerSince: new Date("2024-05-01T00:00:00.000Z"),
    ...patch,
  };
}

describe("demo dataset governance", () => {
  const now = new Date("2026-10-16T00:00:00.000Z");

  it("keeps the executive total on the real company when test data is present", () => {
    const rows = commercialCompanies([
      company({ annualRevenue: 10000 }),
      company({ id: "b", name: "Prova", annualRevenue: 500000, notes: "TEST DATA" }),
    ]);
    expect(executiveLayer(rows, now, "Altro").lifetime.totalRevenue).toBe(10000);
  });

  it("keeps MRR on the real company when the QA dataset is present", () => {
    const view = businessDesk(commercialCompanies([
      company({ monthlyRevenue: 100, annualRevenue: 1200 }),
      company({ id: "b", name: "QA", monthlyRevenue: 10000, annualRevenue: 120000, notes: "QA_DATASET_2026" }),
    ]), now, "month", "Altro");
    expect(view.kpis.mrr).toBe(100);
  });

  it("keeps ARR free of demo records", () => {
    const view = businessDesk(commercialCompanies([
      company({ monthlyRevenue: 100, annualRevenue: 1200 }),
      company({ id: "b", name: "QA", monthlyRevenue: 10000, annualRevenue: 120000, notes: "QA_DATASET_2026" }),
    ]), now, "month", "Altro");
    expect(view.kpis.arr).toBe(1200);
  });

  it("omits a demo company from the revenue ranking and the plan total", () => {
    const view = businessDesk(commercialCompanies([
      company({ name: "Azienda A", annualRevenue: 10000, plan: "CORE" }),
      company({ id: "b", name: "Prova", annualRevenue: 500000, plan: "CORE", notes: "TEST DATA" }),
    ]), now, "month", "Altro");
    expect(view.top.map((row) => row.name)).toEqual(["Azienda A"]);
    expect(view.plans.revenue.find((row) => row.label === "CORE")?.value).toBe(10000);
  });

  it("omits a demo company from growth", () => {
    const points = growthSinceLaunch(commercialCompanies([
      company({ annualRevenue: 10000 }),
      company({ id: "b", name: "Prova", annualRevenue: 500000, notes: "TEST DATA" }),
    ]), now);
    expect(points.at(-1)?.revenue).toBe(10000);
  });

  it("keeps the demo marker when the company form sends another note", () => {
    expect(preservedNotes("TEST DATA", "nota nuova")).toBe("TEST DATA");
    expect(preservedNotes("QA_DATASET_2026", "")).toBe("QA_DATASET_2026");
    expect(preservedNotes("cliente", "nota nuova")).toBe("nota nuova");
  });

  it("does not select MRC PROJECT SRL when it is not marked as test data", () => {
    const real = { id: "real", name: "MRC PROJECT SRL", notes: null };
    const marked = { id: "demo", name: "MRC PROJECT SRL", notes: "TEST DATA" };
    expect(demoRecordToUpdate([real], "MRC PROJECT SRL", "TEST DATA")).toBeNull();
    expect(demoRecordToUpdate([real, marked], "MRC PROJECT SRL", "TEST DATA")?.id).toBe("demo");
  });

  it("allows demo cleanup only for the super admin", () => {
    expect(canClearDemoDataset(undefined)).toBe(false);
    expect(canClearDemoDataset("PLATFORM_ADMIN")).toBe(false);
    expect(canClearDemoDataset("READ_ONLY")).toBe(false);
    expect(canClearDemoDataset("SUPER_ADMIN")).toBe(true);
  });
});
