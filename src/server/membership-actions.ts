"use server";

import { AuditAction, AuditSubjectType, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { hasRole, requireMember } from "@/lib/access";
import { createToken, hashPassword, hashToken } from "@/lib/password";
import { prisma, withTenant } from "@/lib/prisma";
import { signSession, writeSessionCookie } from "@/lib/session";

const roles = Object.values(RoleName);
const inviteDays = 7;

function selectedRoles(formData: FormData): RoleName[] {
  return roles.filter((role) => formData.getAll("roles").includes(role));
}

async function requireOwner() {
  const member = await requireMember();
  if (!hasRole(member.activeRoles, RoleName.OWNER)) redirect("/dashboard");
  return member;
}

export async function inviteUser(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const assigned = selectedRoles(formData);
  if (!email || assigned.length === 0) return "common.required";

  const existingUser = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
    return tx.user.findUnique({ where: { email } });
  });
  if (existingUser) return "users.emailTaken";

  const token = createToken();
  try {
    await withTenant(member.session.companyId, async (tx) => {
      const openInvite = await tx.invitation.findFirst({
        where: {
          companyId: member.session.companyId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (openInvite) throw new Error("open-invite");
      const invitation = await tx.invitation.create({
        data: {
          companyId: member.session.companyId,
          email,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000),
          roles: {
            create: assigned.map((role) => ({ companyId: member.session.companyId, role })),
          },
        },
      });
      await recordAudit(tx, {
        companyId: member.session.companyId,
        actorUserId: member.user.id,
        action: AuditAction.INVITATION_CREATED,
        subjectType: AuditSubjectType.INVITATION,
        subjectId: invitation.id,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "open-invite") return "users.emailTaken";
    throw error;
  }

  revalidatePath("/dashboard/users");
  return `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${token}`;
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const member = await requireOwner();
  const invitationId = String(formData.get("invitationId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: { id: invitationId, companyId: member.session.companyId, acceptedAt: null, revokedAt: null },
    });
    if (!invitation) return;
    await tx.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.INVITATION_REVOKED,
      subjectType: AuditSubjectType.INVITATION,
      subjectId: invitation.id,
    });
  });
  revalidatePath("/dashboard/users");
}

export async function acceptInvitation(_state: string | null, formData: FormData): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return "auth.passwordTooShort";
  const tokenHash = hashToken(token);
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.invite_token', ${tokenHash}, true)`;
    return tx.invitation.findUnique({
      where: { tokenHash },
      include: { roles: true },
    });
  });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
    return "invite.invalid";
  }
  const existingUser = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_email', ${invitation.email}, true)`;
    return tx.user.findUnique({ where: { email: invitation.email } });
  });
  if (existingUser) return "users.emailTaken";

  const passwordHash = await hashPassword(password);
  const user = await withTenant(invitation.companyId, async (tx) => {
    const created = await tx.user.create({
      data: { companyId: invitation.companyId, email: invitation.email },
    });
    await tx.authCredential.create({ data: { userId: created.id, passwordHash } });
    await tx.roleAssignment.createMany({
      data: invitation.roles.map((role) => ({
        companyId: invitation.companyId,
        userId: created.id,
        role: role.role,
        assignedAt: new Date(),
      })),
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await recordAudit(tx, {
      companyId: invitation.companyId,
      actorUserId: created.id,
      action: AuditAction.INVITATION_ACCEPTED,
      subjectType: AuditSubjectType.INVITATION,
      subjectId: invitation.id,
    });
    for (const role of invitation.roles) {
      await recordAudit(tx, {
        companyId: invitation.companyId,
        actorUserId: created.id,
        action: AuditAction.ROLE_ASSIGNED,
        subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
        subjectId: created.id,
      });
      void role;
    }
    return created;
  });

  await writeSessionCookie(
    await signSession({ sub: user.id, companyId: user.companyId, email: user.email }),
  );
  redirect("/dashboard");
}

export async function assignRole(formData: FormData): Promise<void> {
  const member = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as RoleName;
  if (!roles.includes(role)) return;
  await withTenant(member.session.companyId, async (tx) => {
    const target = await tx.user.findFirst({ where: { id: userId, companyId: member.session.companyId } });
    if (!target) return;
    const open = await tx.roleAssignment.findFirst({
      where: { userId, companyId: member.session.companyId, role, revokedAt: null },
    });
    if (open) return;
    const created = await tx.roleAssignment.create({
      data: { companyId: member.session.companyId, userId, role, assignedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ROLE_ASSIGNED,
      subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
      subjectId: created.id,
    });
  });
  revalidatePath("/dashboard/users");
}

export async function revokeRole(formData: FormData): Promise<void> {
  const member = await requireOwner();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const assignment = await tx.roleAssignment.findFirst({
      where: { id: assignmentId, companyId: member.session.companyId, revokedAt: null },
    });
    if (!assignment) return;
    if (assignment.role === RoleName.OWNER) {
      const owners = await tx.roleAssignment.count({
        where: { companyId: member.session.companyId, role: RoleName.OWNER, revokedAt: null },
      });
      if (owners <= 1) return;
    }
    await tx.roleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ROLE_REVOKED,
      subjectType: AuditSubjectType.ROLE_ASSIGNMENT,
      subjectId: assignment.id,
    });
  });
  revalidatePath("/dashboard/users");
}

export async function revokeUser(formData: FormData): Promise<void> {
  const member = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (userId === member.user.id) return;
  await withTenant(member.session.companyId, async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: userId, companyId: member.session.companyId, revokedAt: null },
      include: { roleAssignments: { where: { revokedAt: null } } },
    });
    if (!target) return;
    const isOwner = target.roleAssignments.some((role) => role.role === RoleName.OWNER);
    if (isOwner) {
      const owners = await tx.roleAssignment.count({
        where: { companyId: member.session.companyId, role: RoleName.OWNER, revokedAt: null },
      });
      if (owners <= 1) return;
    }
    await tx.user.update({ where: { id: target.id }, data: { revokedAt: new Date() } });
    await tx.roleAssignment.updateMany({
      where: { userId: target.id, companyId: member.session.companyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.USER_REVOKED,
      subjectType: AuditSubjectType.USER,
      subjectId: target.id,
    });
  });
  revalidatePath("/dashboard/users");
}
