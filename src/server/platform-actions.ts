"use server";

import { AuditAction, AuditActorKind, AuditSubjectType, BillingCycle, ContractStatus, OrderPhase, Prisma, RoleName, TimeUnit } from "@prisma/client";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { commercialCompanies, preservedNotes } from "@/lib/analytics-test-companies";
import { commercialQuote } from "@/lib/commercial-quote";
import { companyDeleteDecision } from "@/lib/platform-customer";
import { updateOwned } from "@/lib/tenant-write";
import { objectKey, writeObject } from "@/lib/object-storage";
import { createToken, hashPassword, hashToken } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";
import { clearPlatformCookie, readPlatformSession, signSession, writePlatformCookie } from "@/lib/session";

async function requirePlatform() {
  const session = await readPlatformSession();
  if (!session || session.kind !== "platform") redirect("/platform/login");
  return session;
}

async function platformAudit(companyId: string, action: AuditAction) {
  await withTenant(companyId, (tx) => recordAudit(tx, {
    companyId,
    actorUserId: null,
    actorKind: AuditActorKind.PLATFORM,
    action,
    subjectType: AuditSubjectType.COMPANY,
    subjectId: companyId,
  }));
}

export async function signInPlatform(_state: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const expectedEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPassword || email !== expectedEmail || password !== expectedPassword) return "auth.invalidCredentials";
  await writePlatformCookie(await signSession({ sub: "platform-admin", companyId: "", email, kind: "platform", platformRole: "SUPER_ADMIN" }));
  redirect("/platform");
}

export async function signOutPlatform(): Promise<void> {
  await clearPlatformCookie();
  redirect("/platform/login");
}

export async function createPilotCompany(formData: FormData): Promise<void> {
  await requirePlatform();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const starter = await prisma.plan.findFirst({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } });
  if (!starter) return;
  const company = await prisma.company.create({ data: { name, timeUnit: TimeUnit.HOUR, planId: starter.id } });
  await platformAudit(company.id, AuditAction.COMPANY_CREATED);
  redirect(`/platform?company=${company.id}&tab=owner`);
}

export async function setCompanyActive(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  const current = await prisma.company.findUnique({ where: { id: companyId } });
  if (!current || current.deletedAt) redirect("/platform");
  await prisma.company.update({
    where: { id: companyId },
    data: { closedAt: active ? null : new Date() },
  });
  if (!active) await platformAudit(companyId, AuditAction.COMPANY_SUSPENDED);
  redirect("/platform");
}

export async function assignCompanyOwner(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? formData.get("firstName") ?? "").trim();
  const [firstName, ...restName] = fullName.split(/\s+/).filter(Boolean);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || !email || password.length < 8) return;
  const existing = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    return tx.user.findUnique({ where: { email } });
  });
  if (existing) return;
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
    const created = await tx.user.create({
      data: { companyId, email, firstName: firstName || null, lastName: restName.join(" ") || null },
    });
    await tx.authCredential.create({ data: { userId: created.id, passwordHash } });
    await tx.roleAssignment.create({
      data: { companyId, userId: created.id, role: RoleName.OWNER, assignedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId,
      actorUserId: created.id,
      action: AuditAction.ROLE_ASSIGNED,
      subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
      subjectId: created.id,
    });
    await recordAudit(tx, {
      companyId,
      actorUserId: null,
      actorKind: AuditActorKind.PLATFORM,
      action: AuditAction.OWNER_ASSIGNED,
      subjectType: AuditSubjectType.COMPANY,
      subjectId: companyId,
    });
  });
  redirect(`/platform?company=${companyId}&tab=owner`);
}

const imageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function saveCompanyLogo(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) redirect("/platform");
  const uploaded = formData.get("logo");
  if (!(uploaded instanceof File) || uploaded.size === 0) redirect("/platform");
  const extension = imageTypes.get(uploaded.type);
  if (!extension || uploaded.size > 2 * 1024 * 1024) redirect("/platform?error=company.logoInvalid");
  const logoKey = `${objectKey(companyId, "brand")}.${extension}`;
  await writeObject(logoKey, new Uint8Array(await uploaded.arrayBuffer()));
  await prisma.company.update({ where: { id: companyId }, data: { logoKey } });
  redirect("/platform");
}

export async function loadPlatformCompanies(archived = false) {
  await requirePlatform();
  const companies = await prisma.company.findMany({
    where: { deletedAt: archived ? { not: null } : null },
    orderBy: { name: "asc" },
    include: { plan: { select: { name: true } } },
  });
  const rows = [];
  for (const company of companies) {
    const counts = await withTenant(company.id, async (tx) => {
      const people = await tx.user.findMany({
        where: { companyId: company.id, revokedAt: null, roleAssignments: { some: { companyId: company.id, role: RoleName.OWNER, revokedAt: null } } },
        select: { firstName: true, lastName: true, email: true },
        orderBy: { email: "asc" },
      });
      return {
        orders: await tx.productionOrder.count({ where: { companyId: company.id, hiddenAt: null } }),
        measurements: await tx.measurement.count({ where: { companyId: company.id } }),
        users: await tx.user.count({ where: { companyId: company.id, revokedAt: null } }),
        ownerNames: people.map((person) => [person.firstName, person.lastName].filter((part) => part && part.trim()).join(" ") || person.email).join(", "),
      };
    });
    rows.push({
      id: company.id,
      name: company.name,
      slogan: company.slogan,
      logoKey: company.logoKey,
      active: company.closedAt === null,
      closedAt: company.closedAt,
      deletedAt: company.deletedAt,
      plan: company.plan.name,
      contractStatus: company.contractStatus,
      activatedAt: company.activatedAt,
      renewalAt: company.renewalAt,
      ...counts,
    });
  }
  return rows;
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function day(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function billingOf(value: string): BillingCycle {
  return value === BillingCycle.YEARLY ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
}

function contractOf(value: string): ContractStatus {
  if (value === ContractStatus.ACTIVE || value === ContractStatus.SUSPENDED || value === ContractStatus.EXPIRED) return value;
  return ContractStatus.TRIAL;
}

function money(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return new Prisma.Decimal(amount.toFixed(2));
}

function sameTime(left: Date | null, right: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

export async function loadBusinessDesk() {
  await requirePlatform();
  const companies = commercialCompanies(await prisma.company.findMany({ orderBy: { name: "asc" }, include: { plan: { select: { name: true } } } }));
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    deletedAt: company.deletedAt,
    closedAt: company.closedAt,
    contractStatus: company.contractStatus,
    plan: company.plan.name,
    billingCycle: company.billingCycle,
    region: company.region,
    province: company.province,
    country: company.country,
    monthlyRevenue: company.monthlyRevenue ? Number(company.monthlyRevenue) : 0,
    annualRevenue: company.annualRevenue ? Number(company.annualRevenue) : 0,
    renewalAt: company.renewalAt,
    expiresAt: company.expiresAt,
    lastPaymentAt: company.lastPaymentAt,
    activatedAt: company.activatedAt,
    customerSince: company.customerSince,
  }));
}

export async function loadCustomerProfile(companyId: string) {
  await requirePlatform();
  const company = await prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } });
  if (!company) return null;
  return withTenant(companyId, async (tx) => {
    const owner = await tx.user.findFirst({
      where: { companyId, revokedAt: null, roleAssignments: { some: { companyId, role: RoleName.OWNER, revokedAt: null } } },
      orderBy: { createdAt: "asc" },
    });
    const fallbackOwner = owner ?? await tx.user.findFirst({
      where: { companyId, roleAssignments: { some: { companyId, role: RoleName.OWNER } } },
      orderBy: { createdAt: "asc" },
    });
    const activeUsers = await tx.user.count({ where: { companyId, revokedAt: null } });
    const activeOrders = await tx.productionOrder.count({
      where: { companyId, hiddenAt: null, phase: { in: [OrderPhase.DRAFT, OrderPhase.IN_PRODUCTION] } },
    });
    const lastAudit = await tx.auditEvent.findFirst({ where: { companyId }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } });
    const history = await tx.auditEvent.findMany({ where: { companyId }, orderBy: { occurredAt: "desc" }, take: 40, select: { id: true, action: true, occurredAt: true } });
    return {
      company,
      owner: fallbackOwner,
      activeUsers,
      activeOrders,
      history,
      usage: {
        users: activeUsers,
        orders: await tx.productionOrder.count({ where: { companyId, hiddenAt: null } }),
        measurements: await tx.measurement.count({ where: { companyId } }),
        machines: await tx.machine.count({ where: { companyId, hiddenAt: null } }),
        tools: await tx.tool.count({ where: { companyId, hiddenAt: null } }),
        storage: (await tx.drawing.count({ where: { companyId } })) + (await tx.technicalDocument.count({ where: { companyId } })) + (await tx.certification.count({ where: { companyId } })),
        lastActivity: lastAudit?.occurredAt ?? null,
      },
    };
  });
}

function percent(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!value) return new Prisma.Decimal(0);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) return null;
  return new Prisma.Decimal(amount.toFixed(2));
}

export async function saveCustomerCompany(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/platform?company=${companyId}&tab=company`);
  const current = await prisma.company.findUnique({ where: { id: companyId } });
  if (!current || current.deletedAt) redirect("/platform");
  const planId = String(formData.get("planId") ?? "");
  const selectedPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!selectedPlan) redirect(`/platform?company=${companyId}&tab=company`);
  const discount = percent(formData, "annualDiscountPercent");
  if (!discount) redirect(`/platform?company=${companyId}&tab=company&error=platform.contract.discountInvalid`);
  const monthlyRevenue = money(formData, "monthlyRevenue") ?? new Prisma.Decimal(0);
  const billingCycle = billingOf(String(formData.get("billingCycle") ?? ""));
  const quote = commercialQuote(Number(monthlyRevenue), Number(discount));
  const priceChanged = !monthlyRevenue.equals(current.monthlyRevenue ?? new Prisma.Decimal(0)) || !discount.equals(current.annualDiscountPercent);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name,
      businessName: text(formData, "businessName"),
      vatNumber: text(formData, "vatNumber"),
      taxCode: text(formData, "taxCode"),
      pec: text(formData, "pec"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      mobile: text(formData, "mobile"),
      website: text(formData, "website"),
      notes: preservedNotes(current.notes, text(formData, "notes")),
      planId,
      billingCycle,
      monthlyRevenue,
      annualDiscountPercent: discount,
      ...(priceChanged ? { annualRevenue: new Prisma.Decimal(quote.annualNet.toFixed(2)) } : {}),
    },
  });
  await platformAudit(companyId, AuditAction.COMPANY_UPDATED);
  if (current.planId !== planId) await platformAudit(companyId, AuditAction.PLAN_CHANGED);
  if (current.billingCycle !== billingCycle) await platformAudit(companyId, AuditAction.CONTRACT_CHANGED);
  redirect(`/platform?company=${companyId}&tab=company`);
}

export async function saveCustomerAddress(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  await prisma.company.update({
    where: { id: companyId },
    data: {
      addressLine: text(formData, "addressLine"),
      zipCode: text(formData, "zipCode"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      region: text(formData, "region"),
      country: text(formData, "country"),
    },
  });
  await platformAudit(companyId, AuditAction.COMPANY_UPDATED);
  redirect(`/platform?company=${companyId}&tab=address`);
}

export async function saveCustomerContract(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const current = await prisma.company.findUnique({ where: { id: companyId } });
  if (!current || current.deletedAt) redirect("/platform");
  const contractStatus = contractOf(String(formData.get("contractStatus") ?? ""));
  const planId = String(formData.get("planId") ?? "");
  const selectedPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!selectedPlan) redirect(`/platform?company=${companyId}&tab=contract`);
  const billingCycle = billingOf(String(formData.get("billingCycle") ?? ""));
  const activatedAt = day(formData, "activatedAt");
  const renewalAt = day(formData, "renewalAt");
  const expiresAt = day(formData, "expiresAt");
  const lastPaymentAt = day(formData, "lastPaymentAt");
  const nextPaymentAt = day(formData, "nextPaymentAt");
  const customerSince = day(formData, "customerSince");
  const contractNotes = text(formData, "contractNotes");
  const monthlyRevenue = money(formData, "monthlyRevenue");
  const annualRevenue = money(formData, "annualRevenue");
  await prisma.company.update({
    where: { id: companyId },
    data: {
      planId,
      billingCycle,
      contractStatus,
      activatedAt,
      renewalAt,
      expiresAt,
      lastPaymentAt,
      nextPaymentAt,
      customerSince,
      contractNotes,
      monthlyRevenue,
      annualRevenue,
      closedAt: contractStatus === ContractStatus.SUSPENDED ? current.closedAt ?? new Date() : null,
    },
  });
  if (current.planId !== planId) await platformAudit(companyId, AuditAction.PLAN_CHANGED);
  if (!sameTime(current.renewalAt, renewalAt)) await platformAudit(companyId, AuditAction.RENEWAL_UPDATED);
  if (!sameTime(current.lastPaymentAt, lastPaymentAt) || !sameTime(current.nextPaymentAt, nextPaymentAt) || current.contractNotes !== contractNotes) {
    await platformAudit(companyId, AuditAction.PAYMENT_UPDATED);
  }
  if (contractStatus === ContractStatus.SUSPENDED && current.contractStatus !== ContractStatus.SUSPENDED) {
    await platformAudit(companyId, AuditAction.COMPANY_SUSPENDED);
  }
  if (current.billingCycle !== billingCycle || current.contractStatus !== contractStatus || !sameTime(current.activatedAt, activatedAt) || !sameTime(current.expiresAt, expiresAt) || !sameTime(current.customerSince, customerSince)) {
    await platformAudit(companyId, AuditAction.CONTRACT_CHANGED);
  }
  redirect(`/platform?company=${companyId}&tab=contract`);
}

export async function saveOwnerContact(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const [firstName, ...restName] = fullName.split(/\s+/).filter(Boolean);
  await withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId } });
    if (!user) return;
    await updateOwned(tx.user, user.id, companyId, { firstName: firstName || null, lastName: restName.join(" ") || null, phone: text(formData, "phone") });
    await recordAudit(tx, {
      companyId,
      actorUserId: null,
      actorKind: AuditActorKind.PLATFORM,
      action: AuditAction.OWNER_CHANGED,
      subjectType: AuditSubjectType.COMPANY,
      subjectId: companyId,
    });
  });
  redirect(`/platform?company=${companyId}&tab=owner`);
}

export async function resetOwnerPassword(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/platform?company=${companyId}&tab=owner&error=auth.passwordTooShort`);
  await withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId } });
    if (!user) return;
    await tx.authCredential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(password) } });
  });
  redirect(`/platform?company=${companyId}&tab=owner`);
}

export async function disableOwnerAccount(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  await withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId } });
    if (!user) return;
    await updateOwned(tx.user, user.id, companyId, { revokedAt: new Date() });
  });
  redirect(`/platform?company=${companyId}&tab=owner`);
}

export async function prepareOwnerAccess(_state: string | null, formData: FormData): Promise<string | null> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const token = createToken();
  const updated = await withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId } });
    if (!user) return false;
    await tx.authCredential.update({
      where: { userId: user.id },
      data: { resetTokenHash: hashToken(token), resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return true;
  });
  if (!updated) return null;
  return `${process.env.APP_URL ?? "http://localhost:3002"}/reset-password?token=${token}`;
}

export async function deleteCustomerCompany(formData: FormData): Promise<void> {
  const session = await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.deletedAt) redirect("/platform");
  const counts = await withTenant(companyId, async (tx) => ({
    activeUsers: await tx.user.count({ where: { companyId, revokedAt: null } }),
    activeOrders: await tx.productionOrder.count({
      where: { companyId, hiddenAt: null, phase: { in: [OrderPhase.DRAFT, OrderPhase.IN_PRODUCTION] } },
    }),
  }));
  const decision = companyDeleteDecision({
    confirmation: String(formData.get("confirmation") ?? ""),
    activeUsers: counts.activeUsers,
    activeOrders: counts.activeOrders,
  });
  if (decision === "unconfirmed") redirect(`/platform?company=${companyId}&tab=delete&error=platform.delete.confirm`);
  if (decision === "blocked") redirect(`/platform?company=${companyId}&tab=delete&error=platform.delete.blocked`);
  await prisma.company.update({
    where: { id: companyId },
    data: { deletedAt: new Date(), deletedBy: session.email, closedAt: company.closedAt ?? new Date() },
  });
  await platformAudit(companyId, AuditAction.COMPANY_DELETED);
  redirect("/platform");
}

export async function restoreCustomerCompany(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.deletedAt) redirect("/platform?archive=1");
  await prisma.company.update({
    where: { id: companyId },
    data: { deletedAt: null, deletedBy: null },
  });
  await platformAudit(companyId, AuditAction.COMPANY_RESTORED);
  redirect("/platform");
}
