"use server";

import { AuditAction, AuditSubjectType, RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { hasRole, requireMember } from "@/lib/access";
import { hashPassword } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";

/** Login id stored in User.email (auth lookup key). Not a mailbox. */
function slugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function operatorLoginId(firstName: string, lastName: string): string {
  const a = slugPart(firstName);
  const b = slugPart(lastName);
  return a && b ? `${a}.${b}` : a || b;
}

async function uniqueLoginId(base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_email', ${candidate}, true)`;
      return tx.user.findUnique({ where: { email: candidate } });
    });
    if (!existing) return candidate;
    candidate = `${base}.${n}`;
    n += 1;
  }
}

export async function createOperator(_state: string | null, formData: FormData): Promise<string | null> {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER)) return "auth.invalidCredentials";
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!firstName || !lastName) return "common.required";
  if (password.length < 8) return "auth.passwordTooShort";
  const base = operatorLoginId(firstName, lastName);
  if (!base) return "common.required";
  const loginId = await uniqueLoginId(base);
  const passwordHash = await hashPassword(password);
  await withTenant(session.companyId, async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId: session.companyId,
        email: loginId,
        firstName,
        lastName,
      },
    });
    await tx.authCredential.create({ data: { userId: created.id, passwordHash } });
    await tx.roleAssignment.create({
      data: { companyId: session.companyId, userId: created.id, role: RoleName.OPERATOR, assignedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId: session.companyId,
      actorUserId: session.sub,
      action: AuditAction.ROLE_ASSIGNED,
      subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
      subjectId: created.id,
    });
  });
  redirect(`/dashboard/operators?created=1&login=${encodeURIComponent(loginId)}`);
}
