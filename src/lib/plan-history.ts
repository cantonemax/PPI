export type PlanStatusName = "ACTIVE" | "DISABLED";
export type PlanChangeName = "PLAN_CREATED" | "PLAN_MODIFIED" | "FEATURE_ADDED" | "FEATURE_REMOVED" | "PRICE_CHANGED" | "LIMIT_CHANGED" | "PLAN_DISABLED" | "PLAN_REACTIVATED";

export type PlanSnapshot = {
  name: string;
  description: string | null;
  badgeColor: string;
  displayOrder: number;
  status: PlanStatusName;
  monthlyPrice: number;
  annualPrice: number;
  activationFee: number;
  annualDiscountPercent: number;
  customPricingAllowed: boolean;
  maxUsers: number | null;
  maxDepartments: number | null;
  maxMachines: number | null;
  maxOrders: number | null;
  maxMeasurements: number | null;
  maxStorageMb: number | null;
  notes: string | null;
  features: Record<string, boolean>;
};

export type PlanHistoryDraft = {
  action: PlanChangeName;
  previousValue: string | null;
  newValue: string | null;
};

const limits = ["maxUsers", "maxDepartments", "maxMachines", "maxOrders", "maxMeasurements", "maxStorageMb"] as const;
const general = ["name", "description", "badgeColor", "displayOrder", "notes", "activationFee", "annualDiscountPercent", "customPricingAllowed"] as const;

function money(value: number) {
  return `${value} €`;
}

function text(value: string | number | boolean | null) {
  if (value === null || value === "") return "";
  return String(value);
}

export function describePlanChanges(before: PlanSnapshot | null, after: PlanSnapshot): PlanHistoryDraft[] {
  if (!before) return [{ action: "PLAN_CREATED", previousValue: null, newValue: after.name }];
  const changes: PlanHistoryDraft[] = [];
  if (before.status !== after.status) {
    changes.push({
      action: after.status === "DISABLED" ? "PLAN_DISABLED" : "PLAN_REACTIVATED",
      previousValue: before.status,
      newValue: after.status,
    });
  }
  if (before.monthlyPrice !== after.monthlyPrice) {
    changes.push({ action: "PRICE_CHANGED", previousValue: money(before.monthlyPrice), newValue: money(after.monthlyPrice) });
  }
  if (before.annualPrice !== after.annualPrice) {
    changes.push({ action: "PRICE_CHANGED", previousValue: money(before.annualPrice), newValue: money(after.annualPrice) });
  }
  for (const key of limits) {
    if (before[key] !== after[key]) {
      changes.push({ action: "LIMIT_CHANGED", previousValue: `${key}:${text(before[key])}`, newValue: `${key}:${text(after[key])}` });
    }
  }
  const featureKeys = new Set([...Object.keys(before.features), ...Object.keys(after.features)]);
  for (const key of featureKeys) {
    const was = before.features[key] === true;
    const now = after.features[key] === true;
    if (!was && now) changes.push({ action: "FEATURE_ADDED", previousValue: key, newValue: key });
    if (was && !now) changes.push({ action: "FEATURE_REMOVED", previousValue: key, newValue: key });
  }
  for (const key of general) {
    if (text(before[key]) !== text(after[key])) {
      changes.push({ action: "PLAN_MODIFIED", previousValue: `${key}:${text(before[key])}`, newValue: `${key}:${text(after[key])}` });
    }
  }
  return changes;
}
