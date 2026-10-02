"use server";

import { AuditAction, AuditSubjectType, RoleName, TimeUnit } from "@prisma/client";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { objectKey, writeObject } from "@/lib/object-storage";
import { hashPassword } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";
import { clearSessionCookie, readSession, signSession, writeSessionCookie } from "@/lib/session";

async function requirePlatform() {
  const session = await readSession();
  if (!session || session.kind !== "platform") redirect("/platform/login");
  return session;
}

export async function signInPlatform(_state: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const expectedEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPassword || email !== expectedEmail || password !== expectedPassword) return "auth.invalidCredentials";
  await writeSessionCookie(await signSession({ sub: "platform-admin", companyId: "", email, kind: "platform" }));
  redirect("/platform");
}

export async function signOutPlatform(): Promise<void> {
  await clearSessionCookie();
  redirect("/platform/login");
}

export async function createPilotCompany(formData: FormData): Promise<void> {
  await requirePlatform();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.company.create({ data: { name, timeUnit: TimeUnit.HOUR } });
  redirect("/platform");
}

export async function setCompanyActive(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  await prisma.company.update({
    where: { id: companyId },
    data: { closedAt: active ? null : new Date() },
  });
  redirect("/platform");
}

export async function assignCompanyOwner(formData: FormData): Promise<void> {
  await requirePlatform();
  const companyId = String(formData.get("companyId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
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
      data: { companyId, email, firstName: firstName || null },
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
  });
  redirect("/platform");
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

export async function loadPlatformCompanies() {
  await requirePlatform();
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const rows = [];
  for (const company of companies) {
    const counts = await withTenant(company.id, async (tx) => {
      const people = await tx.user.findMany({
        where: { revokedAt: null, roleAssignments: { some: { role: RoleName.OWNER, revokedAt: null } } },
        select: { firstName: true, lastName: true, email: true },
        orderBy: { email: "asc" },
      });
      return {
        orders: await tx.productionOrder.count(),
        measurements: await tx.measurement.count(),
        ownerNames: people.map((person) => [person.firstName, person.lastName].filter((part) => part && part.trim()).join(" ") || person.email).join(", "),
      };
    });
    rows.push({
      id: company.id,
      name: company.name,
      slogan: company.slogan,
      logoKey: company.logoKey,
      active: company.closedAt === null,
      ...counts,
    });
  }
  return rows;
}
