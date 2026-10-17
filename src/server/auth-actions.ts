"use server";

import { AuditAction, AuditSubjectType, RoleName, TimeUnit } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { createToken, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";
import { updateOwned } from "@/lib/tenant-write";
import { clearSessionCookie, readSession, signSession, writeSessionCookie } from "@/lib/session";

const passwordSchema = z.string().min(8);

const signUpSchema = z.object({
  companyName: z.string().trim().min(1),
  timeUnit: z.enum([TimeUnit.MINUTE, TimeUnit.HOUR]),
  email: z.string().trim().email(),
  password: passwordSchema,
});

export async function signUp(_state: string | null, formData: FormData): Promise<string | null> {
  const parsed = signUpSchema.safeParse({
    companyName: formData.get("companyName"),
    timeUnit: formData.get("timeUnit"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return "auth.passwordTooShort";

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    return tx.user.findUnique({ where: { email } });
  });
  if (existing) return "users.emailTaken";

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.$transaction(async (tx) => {
    const starter = await tx.plan.findFirst({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } });
    if (!starter) return null;
    const company = await tx.company.create({
      data: { name: parsed.data.companyName, timeUnit: parsed.data.timeUnit, planId: starter.id },
    });
    await tx.$executeRaw`SELECT set_config('app.company_id', ${company.id}, true)`;
    const created = await tx.user.create({
      data: { companyId: company.id, email },
    });
    await tx.authCredential.create({
      data: { userId: created.id, passwordHash },
    });
    await tx.roleAssignment.create({
      data: {
        companyId: company.id,
        userId: created.id,
        role: RoleName.OWNER,
        assignedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: company.id,
      actorUserId: created.id,
      action: AuditAction.COMPANY_CREATED,
      subjectType: AuditSubjectType.COMPANY,
      subjectId: company.id,
    });
    await recordAudit(tx, {
      companyId: company.id,
      actorUserId: created.id,
      action: AuditAction.ROLE_ASSIGNED,
      subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
      subjectId: created.id,
    });
    return created;
  });
  if (!user) return "auth.invalidCredentials";

  await writeSessionCookie(await signSession({ sub: user.id, companyId: user.companyId, email }));
  redirect("/dashboard");
}

export async function signIn(_state: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    const found = await tx.user.findUnique({
      where: { email },
      include: { authCredential: true, company: true },
    });
    if (!found) return null;
    await tx.$executeRaw`SELECT set_config('app.company_id', ${found.companyId}, true)`;
    const roleAssignments = await tx.roleAssignment.findMany({
      where: { userId: found.id, companyId: found.companyId },
    });
    return { ...found, roleAssignments };
  });
  const credential = user?.authCredential;
  if (!user || !credential || user.revokedAt || user.company.closedAt || user.company.deletedAt) return "auth.invalidCredentials";
  if (!user.roleAssignments.some((role) => role.revokedAt === null)) return "auth.invalidCredentials";
  if (!(await verifyPassword(password, credential.passwordHash))) return "auth.invalidCredentials";

  await withTenant(user.companyId, async (tx) => {
    await updateOwned(tx.user, user.id, user.companyId, { lastLoginAt: new Date() });
    await recordAudit(tx, {
      companyId: user.companyId,
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
    });
  });
  await writeSessionCookie(await signSession({ sub: user.id, companyId: user.companyId, email: user.email }));
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const session = await readSession();
  if (session) {
    await withTenant(session.companyId, (tx) =>
      recordAudit(tx, {
        companyId: session.companyId,
        actorUserId: session.sub,
        action: AuditAction.LOGOUT,
        subjectType: AuditSubjectType.USER,
        subjectId: session.sub,
      }),
    );
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function requestPasswordReset(_state: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    return tx.user.findUnique({ where: { email }, include: { authCredential: true, company: true } });
  });
  if (user?.authCredential && !user.revokedAt && !user.company.closedAt && !user.company.deletedAt) {
    const token = createToken();
    const tokenHash = hashToken(token);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
      await tx.$executeRaw`SELECT set_config('app.company_id', ${user.companyId}, true)`;
      await tx.authCredential.update({
        where: { userId: user.id },
        data: { resetTokenHash: tokenHash, resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
    });
    if (process.env.NODE_ENV !== "production") {
      return `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    }
  }
  return "auth.forgotSent";
}

export async function resetPassword(_state: string | null, formData: FormData): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!passwordSchema.safeParse(password).success) return "auth.passwordTooShort";
  const tokenHash = hashToken(token);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.reset_token', ${tokenHash}, true)`;
    const companyId = await tx.$queryRaw<{ company_id: string | null }[]>`SELECT app_company_for_reset(${tokenHash}) AS company_id`;
    const tenantId = companyId[0]?.company_id;
    if (!tenantId) return false;
    await tx.$executeRaw`SELECT set_config('app.company_id', ${tenantId}, true)`;
    const credential = await tx.authCredential.findUnique({ where: { resetTokenHash: tokenHash } });
    if (!credential?.resetExpiresAt || credential.resetExpiresAt < new Date()) return false;
    await tx.authCredential.update({
      where: { userId: credential.userId },
      data: { passwordHash: await hashPassword(password), resetTokenHash: null, resetExpiresAt: null },
    });
    return true;
  });
  if (!updated) return "auth.resetInvalid";
  redirect("/login");
}
