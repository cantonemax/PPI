import { describe, expect, it } from "vitest";
import { QA_DATASET_2026, qaDatasetCompanies } from "@/lib/analytics-test-companies";
import { describePlanChanges, type PlanSnapshot } from "@/lib/plan-history";
import { planPermissions } from "@/lib/platform-access";

const base = (): PlanSnapshot => ({
  name: "CORE",
  description: null,
  badgeColor: "#2dd4bf",
  displayOrder: 2,
  status: "ACTIVE",
  monthlyPrice: 149,
  annualPrice: 1490,
  activationFee: 0,
  annualDiscountPercent: 0,
  customPricingAllowed: false,
  maxUsers: 10,
  maxDepartments: 3,
  maxMachines: 5,
  maxOrders: 100,
  maxMeasurements: 5000,
  maxStorageMb: 5000,
  notes: null,
  features: { spc: true, pdfExport: false },
});

describe("plan catalog", () => {
  it("lets only the super admin change plans", () => {
    expect(planPermissions("SUPER_ADMIN").edit).toBe(true);
    expect(planPermissions("SUPER_ADMIN").history).toBe(true);
    expect(planPermissions("PLATFORM_ADMIN")).toMatchObject({ view: true, edit: false, prices: false, history: false });
    expect(planPermissions("READ_ONLY").edit).toBe(false);
    expect(planPermissions("READ_ONLY").view).toBe(true);
  });

  it("records price, feature, limit and status changes", () => {
    const before = base();
    const after = base();
    after.monthlyPrice = 199;
    after.maxUsers = 12;
    after.features = { spc: false, pdfExport: true };
    after.status = "DISABLED";
    const changes = describePlanChanges(before, after);
    expect(changes.map((change) => change.action)).toEqual(["PLAN_DISABLED", "PRICE_CHANGED", "LIMIT_CHANGED", "FEATURE_REMOVED", "FEATURE_ADDED"]);
    expect(changes.find((change) => change.action === "PRICE_CHANGED")).toMatchObject({ previousValue: "149 €", newValue: "199 €" });
    expect(describePlanChanges(null, after)[0]?.action).toBe("PLAN_CREATED");
  });

  it("prepares twelve QA companies across the four plans", () => {
    expect(qaDatasetCompanies).toHaveLength(12);
    expect(QA_DATASET_2026).toBe("QA_DATASET_2026");
    const counts = qaDatasetCompanies.reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.planName]: (sum[row.planName] ?? 0) + 1 }), {});
    expect(counts).toEqual({ FREE: 2, CORE: 5, PROFESSIONAL: 3, ENTERPRISE: 2 });
    for (const row of qaDatasetCompanies) {
      expect(row.region && row.province && row.country && row.activatedAt && row.renewalAt).toBeTruthy();
    }
  });
});
