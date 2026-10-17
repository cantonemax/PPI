import { companyLifecycle } from "@/lib/platform-customer";

export type DeskPeriod = "month" | "year";
export type CountMode = "customers" | "revenue";
export type RegionMode = CountMode | "active";

export type DeskCompany = {
  id: string;
  name: string;
  deletedAt: Date | null;
  closedAt: Date | null;
  contractStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  plan: string;
  billingCycle: "MONTHLY" | "YEARLY";
  region: string | null;
  province: string | null;
  country: string | null;
  monthlyRevenue: number;
  annualRevenue: number;
  renewalAt: Date | null;
  expiresAt: Date | null;
  lastPaymentAt: Date | null;
  activatedAt: Date | null;
  customerSince: Date | null;
};

export type DeskSlice = { label: string; value: number };
export type DeskPoint = { label: string; value: number };

function recurringMonthly(company: DeskCompany) {
  if (company.billingCycle === "YEARLY") return company.annualRevenue > 0 ? company.annualRevenue / 12 : company.monthlyRevenue;
  return company.monthlyRevenue > 0 ? company.monthlyRevenue : company.annualRevenue / 12;
}

function daysUntil(from: Date, target: Date) {
  return (target.getTime() - from.getTime()) / 86_400_000;
}

function group(companies: DeskCompany[], pick: (company: DeskCompany) => string | null, amount: (company: DeskCompany) => number, otherLabel: string): DeskSlice[] {
  const totals = new Map<string, number>();
  for (const company of companies) {
    const value = amount(company);
    if (value <= 0) continue;
    const label = pick(company)?.trim() || otherLabel;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
}

function monthSeries(companies: DeskCompany[], now: Date): DeskPoint[] {
  const points = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      label: new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date),
      value: 0,
    };
  });
  const index = new Map(points.map((point, position) => [point.key, position]));
  for (const company of companies) {
    const stamp = company.lastPaymentAt ?? now;
    const position = index.get(`${stamp.getUTCFullYear()}-${stamp.getUTCMonth()}`);
    if (position !== undefined) points[position]!.value += company.monthlyRevenue;
  }
  return points.map(({ label, value }) => ({ label, value }));
}

function yearSeries(companies: DeskCompany[], now: Date): DeskPoint[] {
  const start = now.getUTCFullYear() - 4;
  const points = Array.from({ length: 5 }, (_, index) => ({ label: String(start + index), value: 0 }));
  for (const company of companies) {
    const stamp = company.customerSince ?? company.activatedAt ?? now;
    const position = stamp.getUTCFullYear() - start;
    if (position >= 0 && position < points.length) points[position]!.value += company.annualRevenue;
  }
  return points;
}

export function businessDesk(companies: DeskCompany[], now: Date, period: DeskPeriod, otherLabel: string, catalog: string[] = []) {
  const live = companies.filter((company) => company.deletedAt === null);
  const life = (company: DeskCompany) => companyLifecycle(company);
  const active = live.filter((company) => life(company) === "active");
  const renewalRows = (limit: number) => live.flatMap((company) => {
    if (!company.renewalAt) return [];
    const distance = daysUntil(now, company.renewalAt);
    if (distance < 0 || distance > limit) return [];
    return [{ id: company.id, name: company.name, at: company.renewalAt }];
  });
  const byPlace = (pick: (company: DeskCompany) => string | null) => ({
    customers: group(live, pick, () => 1, otherLabel),
    revenue: group(live, pick, (company) => company.annualRevenue, otherLabel),
  });
  const monthRevenue = live.reduce((sum, company) => sum + company.monthlyRevenue, 0);
  const yearRevenue = live.reduce((sum, company) => sum + company.annualRevenue, 0);
  const mrr = live.reduce((sum, company) => sum + recurringMonthly(company), 0);
  return {
    hasRevenue: monthRevenue > 0 || yearRevenue > 0,
    kpis: {
      active: active.length,
      trial: live.filter((company) => life(company) === "trial").length,
      suspended: live.filter((company) => life(company) === "suspended").length,
      monthRevenue,
      yearRevenue,
      mrr,
      arr: mrr * 12,
      renewals: renewalRows(30).length,
    },
    series: period === "year" ? yearSeries(live, now) : monthSeries(live, now),
    plans: {
      customers: (catalog.length > 0 ? catalog : [...new Set(live.map((company) => company.plan))]).map((plan) => ({ label: plan, value: live.filter((company) => company.plan === plan).length })),
      revenue: (catalog.length > 0 ? catalog : [...new Set(live.map((company) => company.plan))]).map((plan) => ({ label: plan, value: live.reduce((sum, company) => sum + (company.plan === plan ? company.annualRevenue : 0), 0) })),
    },
    regions: {
      ...byPlace((company) => company.region),
      active: group(active, (company) => company.region, () => 1, otherLabel),
    },
    provinces: byPlace((company) => company.province),
    countries: byPlace((company) => company.country),
    top: [...live].sort((left, right) => right.annualRevenue - left.annualRevenue || left.name.localeCompare(right.name, "it")).slice(0, 10).map((company, index) => ({
      rank: index + 1,
      id: company.id,
      name: company.name,
      plan: company.plan,
      annualRevenue: company.annualRevenue,
      renewalAt: company.renewalAt,
    })),
    renewals: {
      next30: renewalRows(30),
      next60: renewalRows(60),
      expired: live.filter((company) => company.contractStatus === "EXPIRED" || (company.expiresAt !== null && company.expiresAt < now)).map((company) => ({ id: company.id, name: company.name, at: company.expiresAt })),
      suspended: live.filter((company) => life(company) === "suspended").map((company) => ({ id: company.id, name: company.name, at: company.closedAt })),
    },
  };
}
