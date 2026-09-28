"use server";

import { AuditAction, AuditSubjectType, RoleName, TimeUnit } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { createToken, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";
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
    const company = await tx.company.create({
      data: { name: parsed.data.companyName, timeUnit: parsed.data.timeUnit },
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

  await writeSessionCookie(await signSession({ sub: user.id, companyId: user.companyId, email }));
  redirect("/dashboard");
}

export async function signIn(_state: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    return tx.user.findUnique({
      where: { email },
      include: { authCredential: true, company: true, roleAssignments: true },
    });
  });
  const credential = user?.authCredential;
  if (!user || !credential || user.revokedAt || user.company.closedAt) return "auth.invalidCredentials";
  if (!user.roleAssignments.some((role) => role.revokedAt === null)) return "auth.invalidCredentials";
  if (!(await verifyPassword(password, credential.passwordHash))) return "auth.invalidCredentials";

  await withTenant(user.companyId, (tx) =>
    recordAudit(tx, {
      companyId: user.companyId,
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
    }),
  );
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
  const user = await prisma.user.findUnique({ where: { email }, include: { authCredential: true } });
  if (user?.authCredential && !user.revokedAt) {
    const token = createToken();
    await prisma.authCredential.update({
      where: { userId: user.id },
      data: {
        resetTokenHash: hashToken(token),
        resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
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
  const credential = await prisma.authCredential.findUnique({ where: { resetTokenHash: hashToken(token) } });
  if (!credential?.resetExpiresAt || credential.resetExpiresAt < new Date()) return "auth.resetInvalid";
  await prisma.authCredential.update({
    where: { userId: credential.userId },
    data: { passwordHash: await hashPassword(password), resetTokenHash: null, resetExpiresAt: null },
  });
  redirect("/login");
}
