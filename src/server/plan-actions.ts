"use server";

import { PlanChangeAction, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { describePlanChanges, type PlanSnapshot } from "@/lib/plan-history";
import { planPermissions, type PlatformRole } from "@/lib/platform-access";
import { companyLifecycle } from "@/lib/platform-customer";
import { prisma } from "@/lib/prisma";
import { readPlatformSession } from "@/lib/session";
import { t } from "@/lib/i18n";

async function gate(edit: boolean) {
  const current = await readPlatformSession();
  if (!current || current.kind !== "platform" || !current.platformRole) redirect("/platform/login");
  const role: PlatformRole = current.platformRole;
  const access = planPermissions(role);
  if (edit && !access.edit) redirect("/platform?view=plans");
  const actorName = process.env.PLATFORM_ADMIN_NAME?.trim() || current.email;
  return { email: current.email, actorName, access };
}

function money(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!value) return new Prisma.Decimal(0);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return new Prisma.Decimal(0);
  return new Prisma.Decimal(amount.toFixed(2));
}

function limit(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) return null;
  return amount;
}

async function shot(planId: string): Promise<PlanSnapshot | null> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { features: true } });
  if (!plan) return null;
  return {
    name: plan.name,
    description: plan.description,
    badgeColor: plan.badgeColor,
    displayOrder: plan.displayOrder,
    status: plan.status,
    monthlyPrice: Number(plan.monthlyPrice),
    annualPrice: Number(plan.annualPrice),
    activationFee: Number(plan.activationFee),
    annualDiscountPercent: Number(plan.annualDiscountPercent),
    customPricingAllowed: plan.customPricingAllowed,
    maxUsers: plan.maxUsers,
    maxDepartments: plan.maxDepartments,
    maxMachines: plan.maxMachines,
    maxOrders: plan.maxOrders,
    maxMeasurements: plan.maxMeasurements,
    maxStorageMb: plan.maxStorageMb,
    notes: plan.notes,
    features: Object.fromEntries(plan.features.map((feature) => [feature.featureKey, feature.enabled])),
  };
}

async function record(planId: string, before: PlanSnapshot | null, actor: { actorName: string; email: string }, reason?: string) {
  const after = await shot(planId);
  if (!after) return;
  const drafts = describePlanChanges(before, after);
  if (drafts.length === 0) return;
  await prisma.planChange.createMany({
    data: drafts.map((draft) => ({
      planId,
      actorName: actor.actorName,
      actorEmail: actor.email,
      action: draft.action as PlanChangeAction,
      previousValue: draft.previousValue,
      newValue: draft.newValue,
      reason: draft.action === "PRICE_CHANGED" ? reason ?? null : null,
    })),
  });
}

export async function loadPlanDesk(planId?: string) {
  const current = await gate(false);
  const [plans, usage, features, selected] = await Promise.all([
    prisma.plan.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.company.groupBy({ by: ["planId"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.planFeatureDefinition.findMany({ orderBy: { sortOrder: "asc" } }),
    planId ? prisma.plan.findUnique({ where: { id: planId }, include: { features: true, changes: { orderBy: { occurredAt: "desc" }, take: 50 } } }) : Promise.resolve(null),
  ]);
  const counts = new Map(usage.map((row) => [row.planId, row._count._all]));
  let activeCustomers = 0;
  if (selected) {
    const companies = await prisma.company.findMany({
      where: { planId: selected.id, deletedAt: null },
      select: { deletedAt: true, closedAt: true, contractStatus: true },
    });
    activeCustomers = companies.filter((company) => companyLifecycle(company) === "active").length;
  }
  return { access: current.access, plans, counts, features, selected, activeCustomers };
}

export async function listAssignablePlans(currentId?: string) {
  await gate(false);
  return prisma.plan.findMany({
    where: { OR: [{ status: "ACTIVE" }, ...(currentId ? [{ id: currentId }] : [])] },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });
}

export async function listPlanCatalog() {
  await gate(false);
  const plans = await prisma.plan.findMany({ orderBy: { displayOrder: "asc" }, select: { name: true } });
  return plans.map((plan) => plan.name);
}

export async function createPlan(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/platform?view=plans");
  const order = await prisma.plan.aggregate({ _max: { displayOrder: true } });
  const features = await prisma.planFeatureDefinition.findMany();
  const plan = await prisma.plan.create({
    data: {
      name,
      displayOrder: (order._max.displayOrder ?? 0) + 1,
      features: { create: features.map((feature) => ({ featureKey: feature.key, enabled: false })) },
    },
  });
  await record(plan.id, null, actor);
  redirect(`/platform?view=plans&plan=${plan.id}`);
}

export async function duplicatePlan(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const source = await prisma.plan.findUnique({ where: { id: String(formData.get("planId") ?? "") }, include: { features: true } });
  if (!source) redirect("/platform?view=plans");
  const order = await prisma.plan.aggregate({ _max: { displayOrder: true } });
  const plan = await prisma.plan.create({
    data: {
      name: `${t("platform.plans.copyPrefix")} ${source.name}`,
      description: source.description,
      badgeColor: source.badgeColor,
      displayOrder: (order._max.displayOrder ?? 0) + 1,
      status: "ACTIVE",
      monthlyPrice: source.monthlyPrice,
      annualPrice: source.annualPrice,
      activationFee: source.activationFee,
      annualDiscountPercent: source.annualDiscountPercent,
      customPricingAllowed: source.customPricingAllowed,
      maxUsers: source.maxUsers,
      maxDepartments: source.maxDepartments,
      maxMachines: source.maxMachines,
      maxOrders: source.maxOrders,
      maxMeasurements: source.maxMeasurements,
      maxStorageMb: source.maxStorageMb,
      notes: source.notes,
      features: { create: source.features.map((feature) => ({ featureKey: feature.featureKey, enabled: feature.enabled })) },
    },
  });
  await record(plan.id, null, actor);
  redirect(`/platform?view=plans&plan=${plan.id}`);
}

export async function savePlanGeneral(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/platform?view=plans&plan=${planId}`);
  await prisma.plan.update({
    where: { id: planId },
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      badgeColor: String(formData.get("badgeColor") ?? "#2dd4bf"),
      displayOrder: Number(formData.get("displayOrder") ?? before.displayOrder) || 0,
    },
  });
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function savePlanPricing(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  const monthly = Number(money(formData, "monthlyPrice"));
  const annual = Number(money(formData, "annualPrice"));
  const fee = money(formData, "activationFee");
  const discount = money(formData, "annualDiscountPercent");
  const custom = formData.get("customPricingAllowed") === "1";
  const priceChanged = monthly !== before.monthlyPrice || annual !== before.annualPrice;
  if (priceChanged && String(formData.get("confirmPrice") ?? "") !== "1") {
    const query = new URLSearchParams({
      view: "plans",
      plan: planId,
      confirm: "price",
      monthly: String(monthly),
      annual: String(annual),
      fee: fee.toString(),
      discount: discount.toString(),
      custom: custom ? "1" : "0",
    });
    redirect(`/platform?${query.toString()}`);
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (priceChanged && !reason) {
    const query = new URLSearchParams({ view: "plans", plan: planId, confirm: "price", monthly: String(monthly), annual: String(annual), fee: fee.toString(), discount: discount.toString(), custom: custom ? "1" : "0", needReason: "1" });
    redirect(`/platform?${query.toString()}`);
  }
  await prisma.plan.update({
    where: { id: planId },
    data: { monthlyPrice: monthly, annualPrice: annual, activationFee: fee, annualDiscountPercent: discount, customPricingAllowed: custom },
  });
  await record(planId, before, actor, reason);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function savePlanLimits(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  await prisma.plan.update({
    where: { id: planId },
    data: {
      maxUsers: limit(formData, "maxUsers"),
      maxDepartments: limit(formData, "maxDepartments"),
      maxMachines: limit(formData, "maxMachines"),
      maxOrders: limit(formData, "maxOrders"),
      maxMeasurements: limit(formData, "maxMeasurements"),
      maxStorageMb: limit(formData, "maxStorageMb"),
    },
  });
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function savePlanFeatures(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  const features = await prisma.planFeatureDefinition.findMany();
  await prisma.$transaction(features.map((feature) => prisma.planFeature.upsert({
    where: { planId_featureKey: { planId, featureKey: feature.key } },
    update: { enabled: formData.get(`feature_${feature.key}`) === "1" },
    create: { planId, featureKey: feature.key, enabled: formData.get(`feature_${feature.key}`) === "1" },
  })));
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function savePlanNotes(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  await prisma.plan.update({ where: { id: planId }, data: { notes: String(formData.get("notes") ?? "").trim() || null } });
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function disablePlan(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  if (String(formData.get("confirmDisable") ?? "") !== "1") redirect(`/platform?view=plans&plan=${planId}&confirm=disable`);
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  await prisma.plan.update({ where: { id: planId }, data: { status: "DISABLED" } });
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}

export async function reactivatePlan(formData: FormData): Promise<void> {
  const actor = await gate(true);
  const planId = String(formData.get("planId") ?? "");
  const before = await shot(planId);
  if (!before) redirect("/platform?view=plans");
  await prisma.plan.update({ where: { id: planId }, data: { status: "ACTIVE" } });
  await record(planId, before, actor);
  redirect(`/platform?view=plans&plan=${planId}`);
}
