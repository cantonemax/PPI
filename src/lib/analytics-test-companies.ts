import { BillingCycle, ContractStatus, Prisma, PrismaClient, TimeUnit } from "@prisma/client";

export const ANALYTICS_TEST_MARK = "TEST DATA";

export function isDemoDataset(notes: string | null | undefined) {
  return notes === ANALYTICS_TEST_MARK || notes === "QA_DATASET_2026";
}

export function commercialCompanies<T extends { notes?: string | null }>(companies: T[]) {
  return companies.filter((company) => !isDemoDataset(company.notes));
}

export function preservedNotes(current: string | null, submitted: string | null) {
  return isDemoDataset(current) ? current : submitted;
}

export function demoRecordToUpdate<T extends { name: string; notes: string | null }>(companies: T[], name: string, mark: string) {
  return companies.find((company) => company.name === name && company.notes === mark) ?? null;
}

export function canClearDemoDataset(role: string | undefined) {
  return role === "SUPER_ADMIN";
}

type Row = {
  name: string;
  planName: string;
  billingCycle: BillingCycle;
  contractStatus: ContractStatus;
  region: string;
  province: string;
  country: string;
  city: string;
  zipCode: string;
  monthlyRevenue: string;
  annualRevenue: string;
  activatedAt: string;
  renewalAt: string;
  expiresAt: string | null;
  lastPaymentAt: string;
  customerSince: string;
  closedAt: string | null;
};

export const analyticsTestCompanies: Row[] = [
  { name: "MRC PROJECT SRL", planName: "PROFESSIONAL", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.ACTIVE, region: "Piemonte", province: "Torino", country: "Italia", city: "Torino", zipCode: "10121", monthlyRevenue: "1800.00", annualRevenue: "21600.00", activatedAt: "2026-02-01", renewalAt: "2026-11-02", expiresAt: "2027-02-01", lastPaymentAt: "2026-10-01", customerSince: "2025-02-01", closedAt: null },
  { name: "Officine Lambro Srl", planName: "ENTERPRISE", billingCycle: BillingCycle.YEARLY, contractStatus: ContractStatus.ACTIVE, region: "Lombardia", province: "Milano", country: "Italia", city: "Milano", zipCode: "20121", monthlyRevenue: "4000.00", annualRevenue: "48000.00", activatedAt: "2024-05-12", renewalAt: "2027-05-12", expiresAt: "2027-05-12", lastPaymentAt: "2026-09-12", customerSince: "2024-05-12", closedAt: null },
  { name: "Veneta Stampi Srl", planName: "CORE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.ACTIVE, region: "Veneto", province: "Padova", country: "Italia", city: "Padova", zipCode: "35121", monthlyRevenue: "650.00", annualRevenue: "7800.00", activatedAt: "2026-04-10", renewalAt: "2026-12-01", expiresAt: "2027-04-10", lastPaymentAt: "2026-08-10", customerSince: "2026-04-10", closedAt: null },
  { name: "Emiliana Meccanica Srl", planName: "CORE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.ACTIVE, region: "Emilia-Romagna", province: "Bologna", country: "Italia", city: "Bologna", zipCode: "40121", monthlyRevenue: "820.00", annualRevenue: "9840.00", activatedAt: "2025-01-15", renewalAt: "2026-10-28", expiresAt: "2027-01-15", lastPaymentAt: "2026-07-15", customerSince: "2025-01-15", closedAt: null },
  { name: "Toscana Precision Srl", planName: "PROFESSIONAL", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.ACTIVE, region: "Toscana", province: "Firenze", country: "Italia", city: "Firenze", zipCode: "50122", monthlyRevenue: "1450.00", annualRevenue: "17400.00", activatedAt: "2025-11-01", renewalAt: "2027-01-15", expiresAt: "2026-11-01", lastPaymentAt: "2026-06-01", customerSince: "2025-11-01", closedAt: null },
  { name: "Lazio Componenti Srl", planName: "ENTERPRISE", billingCycle: BillingCycle.YEARLY, contractStatus: ContractStatus.ACTIVE, region: "Lazio", province: "Roma", country: "Italia", city: "Roma", zipCode: "00184", monthlyRevenue: "5200.00", annualRevenue: "62400.00", activatedAt: "2025-06-01", renewalAt: "2026-11-10", expiresAt: "2027-06-01", lastPaymentAt: "2026-05-01", customerSince: "2025-06-01", closedAt: null },
  { name: "Campania Lavorazioni Srl", planName: "FREE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.TRIAL, region: "Campania", province: "Napoli", country: "Italia", city: "Napoli", zipCode: "80121", monthlyRevenue: "0.00", annualRevenue: "0.00", activatedAt: "2026-09-01", renewalAt: "2026-11-20", expiresAt: "2026-12-01", lastPaymentAt: "2026-09-01", customerSince: "2026-09-01", closedAt: null },
  { name: "Adriatica Utensili Srl", planName: "FREE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.TRIAL, region: "Marche", province: "Ancona", country: "Italia", city: "Ancona", zipCode: "60121", monthlyRevenue: "0.00", annualRevenue: "0.00", activatedAt: "2026-10-01", renewalAt: "2026-12-15", expiresAt: "2026-12-31", lastPaymentAt: "2026-10-01", customerSince: "2026-10-01", closedAt: null },
  { name: "Liguria Torneria Srl", planName: "PROFESSIONAL", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.SUSPENDED, region: "Liguria", province: "Genova", country: "Italia", city: "Genova", zipCode: "16121", monthlyRevenue: "1100.00", annualRevenue: "13200.00", activatedAt: "2024-11-01", renewalAt: "2026-08-01", expiresAt: "2026-11-01", lastPaymentAt: "2026-03-01", customerSince: "2024-11-01", closedAt: "2026-08-01" },
  { name: "Trentina Micro Srl", planName: "CORE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.EXPIRED, region: "Trentino-Alto Adige", province: "Trento", country: "Italia", city: "Trento", zipCode: "38121", monthlyRevenue: "540.00", annualRevenue: "6480.00", activatedAt: "2023-03-01", renewalAt: "2026-09-01", expiresAt: "2026-09-01", lastPaymentAt: "2026-04-01", customerSince: "2023-03-01", closedAt: null },
  { name: "Puglia Industrial Srl", planName: "ENTERPRISE", billingCycle: BillingCycle.MONTHLY, contractStatus: ContractStatus.ACTIVE, region: "Puglia", province: "Bari", country: "Italia", city: "Bari", zipCode: "70121", monthlyRevenue: "3100.00", annualRevenue: "37200.00", activatedAt: "2026-03-20", renewalAt: "2026-12-10", expiresAt: "2027-03-20", lastPaymentAt: "2026-10-05", customerSince: "2026-03-20", closedAt: null },
  { name: "Bayerische Präzision GmbH", planName: "CORE", billingCycle: BillingCycle.YEARLY, contractStatus: ContractStatus.ACTIVE, region: "Baviera", province: "Monaco", country: "Germania", city: "Monaco di Baviera", zipCode: "80331", monthlyRevenue: "900.00", annualRevenue: "10800.00", activatedAt: "2025-09-01", renewalAt: "2026-11-05", expiresAt: "2027-09-01", lastPaymentAt: "2026-02-01", customerSince: "2025-09-01", closedAt: null },
];

function stamp(day: string | null) {
  return day ? new Date(`${day}T00:00:00.000Z`) : null;
}

function companyData(row: Row, planId: string, mark: string): Omit<Prisma.CompanyUncheckedCreateInput, "name" | "timeUnit"> {
  return {
    businessName: row.name,
    planId,
    billingCycle: row.billingCycle,
    contractStatus: row.contractStatus,
    region: row.region,
    province: row.province,
    country: row.country,
    city: row.city,
    zipCode: row.zipCode,
    monthlyRevenue: new Prisma.Decimal(row.monthlyRevenue),
    annualRevenue: new Prisma.Decimal(row.annualRevenue),
    activatedAt: stamp(row.activatedAt),
    renewalAt: stamp(row.renewalAt),
    expiresAt: stamp(row.expiresAt),
    lastPaymentAt: stamp(row.lastPaymentAt),
    customerSince: stamp(row.customerSince),
    closedAt: stamp(row.closedAt),
    notes: mark,
    deletedAt: null,
    deletedBy: null,
  };
}

export async function applyMarkedCompanies(db: PrismaClient, rows: Row[], mark: string) {
  const plans = await db.plan.findMany({ select: { id: true, name: true } });
  const planIds = new Map(plans.map((plan) => [plan.name, plan.id]));
  for (const row of rows) {
    const planId = planIds.get(row.planName);
    if (!planId) continue;
    const named = await db.company.findMany({
      where: { name: row.name },
      orderBy: { deletedAt: "asc" },
      select: { id: true, name: true, notes: true },
    });
    const current = demoRecordToUpdate(named, row.name, mark);
    const data = companyData(row, planId, mark);
    if (current) await db.company.update({ where: { id: current.id }, data });
    else await db.company.create({ data: { name: row.name, timeUnit: TimeUnit.HOUR, ...data } });
  }
}

export async function applyAnalyticsTestCompanies(db: PrismaClient) {
  await applyMarkedCompanies(db, analyticsTestCompanies, ANALYTICS_TEST_MARK);
}

export async function clearAnalyticsTestCompanies(db: PrismaClient, deletedBy: string) {
  await removeMarkedCompanies(db, ANALYTICS_TEST_MARK, deletedBy);
}

export async function countMarkedCompanies(db: PrismaClient, mark: string) {
  return db.company.count({ where: { notes: mark, deletedAt: null } });
}

export async function countAnalyticsTestCompanies(db: PrismaClient) {
  return countMarkedCompanies(db, ANALYTICS_TEST_MARK);
}

export async function removeMarkedCompanies(db: PrismaClient, mark: string, deletedBy: string) {
  const rows = await db.company.findMany({
    where: { notes: mark },
    select: { id: true, _count: { select: { users: true, productionOrders: true, auditEvents: true } } },
  });
  const empty = rows.filter((row) => row._count.users === 0 && row._count.productionOrders === 0 && row._count.auditEvents === 0).map((row) => row.id);
  if (empty.length > 0) await db.company.deleteMany({ where: { id: { in: empty }, notes: mark } });
  const kept = rows.filter((row) => !empty.includes(row.id)).map((row) => row.id);
  if (kept.length > 0) {
    const now = new Date();
    await db.company.updateMany({ where: { id: { in: kept }, notes: mark }, data: { deletedAt: now, deletedBy, closedAt: now } });
  }
}

export const QA_DATASET_2026 = "QA_DATASET_2026";

export const qaDatasetCompanies: Row[] = [
  { name: "QA Alfa Studio", planName: "FREE", billingCycle: "MONTHLY", contractStatus: "TRIAL", region: "Piemonte", province: "Torino", country: "Italia", city: "Torino", zipCode: "10121", monthlyRevenue: "0.00", annualRevenue: "0.00", activatedAt: "2026-09-01", renewalAt: "2026-11-20", expiresAt: "2026-12-01", lastPaymentAt: "2026-09-01", customerSince: "2026-09-01", closedAt: null },
  { name: "QA Beta Bottega", planName: "FREE", billingCycle: "MONTHLY", contractStatus: "TRIAL", region: "Marche", province: "Ancona", country: "Italia", city: "Ancona", zipCode: "60121", monthlyRevenue: "0.00", annualRevenue: "0.00", activatedAt: "2026-10-01", renewalAt: "2026-12-12", expiresAt: "2026-12-31", lastPaymentAt: "2026-10-01", customerSince: "2026-10-01", closedAt: null },
  { name: "QA Milano Lavorazioni", planName: "CORE", billingCycle: "MONTHLY", contractStatus: "ACTIVE", region: "Lombardia", province: "Milano", country: "Italia", city: "Milano", zipCode: "20121", monthlyRevenue: "149.00", annualRevenue: "1788.00", activatedAt: "2026-01-10", renewalAt: "2026-11-08", expiresAt: "2027-01-10", lastPaymentAt: "2026-10-10", customerSince: "2026-01-10", closedAt: null },
  { name: "QA Padova Stampi", planName: "CORE", billingCycle: "MONTHLY", contractStatus: "ACTIVE", region: "Veneto", province: "Padova", country: "Italia", city: "Padova", zipCode: "35121", monthlyRevenue: "149.00", annualRevenue: "1788.00", activatedAt: "2025-11-02", renewalAt: "2026-11-02", expiresAt: "2026-11-02", lastPaymentAt: "2026-08-02", customerSince: "2025-11-02", closedAt: null },
  { name: "QA Bologna Meccanica", planName: "CORE", billingCycle: "YEARLY", contractStatus: "ACTIVE", region: "Emilia-Romagna", province: "Bologna", country: "Italia", city: "Bologna", zipCode: "40121", monthlyRevenue: "124.00", annualRevenue: "1490.00", activatedAt: "2025-06-15", renewalAt: "2026-12-01", expiresAt: "2027-06-15", lastPaymentAt: "2026-06-15", customerSince: "2025-06-15", closedAt: null },
  { name: "QA Firenze Precision", planName: "CORE", billingCycle: "MONTHLY", contractStatus: "ACTIVE", region: "Toscana", province: "Firenze", country: "Italia", city: "Firenze", zipCode: "50122", monthlyRevenue: "149.00", annualRevenue: "1788.00", activatedAt: "2026-03-01", renewalAt: "2027-03-01", expiresAt: "2027-03-01", lastPaymentAt: "2026-07-01", customerSince: "2026-03-01", closedAt: null },
  { name: "QA Roma Componenti", planName: "CORE", billingCycle: "MONTHLY", contractStatus: "EXPIRED", region: "Lazio", province: "Roma", country: "Italia", city: "Roma", zipCode: "00184", monthlyRevenue: "149.00", annualRevenue: "1788.00", activatedAt: "2024-04-01", renewalAt: "2026-09-01", expiresAt: "2026-09-01", lastPaymentAt: "2026-04-01", customerSince: "2024-04-01", closedAt: null },
  { name: "QA Napoli Impianti", planName: "PROFESSIONAL", billingCycle: "MONTHLY", contractStatus: "ACTIVE", region: "Campania", province: "Napoli", country: "Italia", city: "Napoli", zipCode: "80121", monthlyRevenue: "349.00", annualRevenue: "4188.00", activatedAt: "2025-08-20", renewalAt: "2026-11-18", expiresAt: "2026-08-20", lastPaymentAt: "2026-09-20", customerSince: "2025-08-20", closedAt: null },
  { name: "QA Genova Torneria", planName: "PROFESSIONAL", billingCycle: "MONTHLY", contractStatus: "SUSPENDED", region: "Liguria", province: "Genova", country: "Italia", city: "Genova", zipCode: "16121", monthlyRevenue: "349.00", annualRevenue: "4188.00", activatedAt: "2025-02-01", renewalAt: "2026-08-01", expiresAt: "2026-02-01", lastPaymentAt: "2026-03-01", customerSince: "2025-02-01", closedAt: "2026-08-01" },
  { name: "QA Bari Industrial", planName: "PROFESSIONAL", billingCycle: "YEARLY", contractStatus: "ACTIVE", region: "Puglia", province: "Bari", country: "Italia", city: "Bari", zipCode: "70121", monthlyRevenue: "291.00", annualRevenue: "3490.00", activatedAt: "2026-05-05", renewalAt: "2027-05-05", expiresAt: "2027-05-05", lastPaymentAt: "2026-05-05", customerSince: "2026-05-05", closedAt: null },
  { name: "QA Trento Sistemi", planName: "ENTERPRISE", billingCycle: "YEARLY", contractStatus: "ACTIVE", region: "Trentino-Alto Adige", province: "Trento", country: "Italia", city: "Trento", zipCode: "38121", monthlyRevenue: "900.00", annualRevenue: "10800.00", activatedAt: "2024-09-01", renewalAt: "2026-11-05", expiresAt: "2027-09-01", lastPaymentAt: "2026-09-01", customerSince: "2024-09-01", closedAt: null },
  { name: "QA München Werke GmbH", planName: "ENTERPRISE", billingCycle: "YEARLY", contractStatus: "ACTIVE", region: "Baviera", province: "Monaco", country: "Germania", city: "Monaco di Baviera", zipCode: "80331", monthlyRevenue: "1200.00", annualRevenue: "14400.00", activatedAt: "2025-01-15", renewalAt: "2026-12-15", expiresAt: "2027-01-15", lastPaymentAt: "2026-01-15", customerSince: "2025-01-15", closedAt: null },
];

export async function applyQaDataset(db: PrismaClient) {
  await applyMarkedCompanies(db, qaDatasetCompanies, QA_DATASET_2026);
}

export async function countQaDataset(db: PrismaClient) {
  return countMarkedCompanies(db, QA_DATASET_2026);
}

export async function clearQaDataset(db: PrismaClient, deletedBy: string) {
  await removeMarkedCompanies(db, QA_DATASET_2026, deletedBy);
}
