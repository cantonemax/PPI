import { businessDesk, type DeskCompany, type DeskPeriod } from "@/lib/platform-analytics";
import { companyLifecycle } from "@/lib/platform-customer";

export const executiveRanges = ["last30", "last90", "last12", "currentYear", "previousYear", "last3Years", "sinceLaunch"] as const;
export type ExecutiveRange = (typeof executiveRanges)[number];

export function readRange(value: string | undefined): ExecutiveRange {
  return executiveRanges.find((range) => range === value) ?? "last12";
}

export function deskPeriodFor(range: ExecutiveRange): DeskPeriod {
  return range === "last30" || range === "last90" || range === "last12" ? "month" : "year";
}

function stampOf(company: DeskCompany) {
  return company.customerSince ?? company.activatedAt ?? company.lastPaymentAt;
}

function matchesRange(company: DeskCompany, range: ExecutiveRange, now: Date) {
  if (range === "last12" || range === "sinceLaunch") return true;
  const stamp = stampOf(company);
  if (!stamp) return false;
  const age = (now.getTime() - stamp.getTime()) / 86_400_000;
  if (range === "last30") return age >= 0 && age <= 30;
  if (range === "last90") return age >= 0 && age <= 90;
  const year = stamp.getUTCFullYear();
  if (range === "currentYear") return year === now.getUTCFullYear();
  if (range === "previousYear") return year === now.getUTCFullYear() - 1;
  return year >= now.getUTCFullYear() - 2 && year <= now.getUTCFullYear();
}

export function availableYears(companies: DeskCompany[]) {
  const years = new Set<number>();
  for (const company of companies) {
    const stamp = stampOf(company);
    if (stamp) years.add(stamp.getUTCFullYear());
  }
  return [...years].sort((left, right) => left - right);
}

export function scopeCompanies(companies: DeskCompany[], range: ExecutiveRange, year: number | null, now: Date) {
  if ((range === "last12" || range === "sinceLaunch") && year === null) return companies;
  return companies.filter((company) => {
    if (!matchesRange(company, range, now)) return false;
    if (year === null) return true;
    return stampOf(company)?.getUTCFullYear() === year;
  });
}

export function growthSinceLaunch(companies: DeskCompany[], now: Date) {
  const born = companies.flatMap((company) => {
    const stamp = company.customerSince ?? company.activatedAt;
    if (!stamp) return [];
    return [{ year: stamp.getUTCFullYear(), revenue: company.annualRevenue }];
  });
  if (born.length === 0) return [];
  const start = Math.min(...born.map((row) => row.year));
  const points: { label: string; revenue: number; customers: number }[] = [];
  let revenue = 0;
  let customers = 0;
  for (let year = start; year <= now.getUTCFullYear(); year += 1) {
    const cohort = born.filter((row) => row.year === year);
    customers += cohort.length;
    revenue += cohort.reduce((sum, row) => sum + row.revenue, 0);
    points.push({ label: String(year), revenue, customers });
  }
  return points;
}

export function executiveLayer(companies: DeskCompany[], now: Date, otherLabel: string, catalog: string[] = []) {
  const desk = businessDesk(companies, now, "month", otherLabel, catalog);
  const live = companies.filter((company) => company.deletedAt === null);
  const active = live.filter((company) => companyLifecycle(company) === "active");
  const plans = new Map<string, number>();
  for (const company of active) plans.set(company.plan, (plans.get(company.plan) ?? 0) + 1);
  const popularPlan = [...plans.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "it"))[0]?.[0] ?? null;
  const next = live
    .filter((company) => company.renewalAt && company.renewalAt >= now)
    .sort((left, right) => (left.renewalAt?.getTime() ?? 0) - (right.renewalAt?.getTime() ?? 0))[0] ?? null;
  return {
    summary: {
      bestCustomer: desk.top[0] ? { id: desk.top[0].id, name: desk.top[0].name } : null,
      bestRegion: desk.regions.revenue[0]?.label ?? null,
      bestProvince: desk.provinces.revenue[0]?.label ?? null,
      bestCountry: desk.countries.revenue[0]?.label ?? null,
      popularPlan,
      nextRenewal: next?.renewalAt ? { id: next.id, name: next.name, at: next.renewalAt } : null,
    },
    lifetime: {
      totalRevenue: companies.reduce((sum, company) => sum + company.annualRevenue, 0),
      acquired: companies.filter((company) => company.activatedAt || company.customerSince).length,
      active: desk.kpis.active,
      lost: companies.filter((company) => company.deletedAt !== null || (company.closedAt !== null && company.contractStatus !== "SUSPENDED")).length,
      averageValue: desk.kpis.active > 0 ? desk.kpis.arr / desk.kpis.active : null,
      popularPlan,
      bestCustomer: desk.top[0]?.name ?? null,
      bestRegion: desk.regions.revenue[0]?.label ?? null,
      bestProvince: desk.provinces.revenue[0]?.label ?? null,
      bestCountry: desk.countries.revenue[0]?.label ?? null,
    },
    growth: growthSinceLaunch(companies, now),
  };
}
