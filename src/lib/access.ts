import { RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { RoleEngine } from "@/lib/auth/role-engine";
import { withTenant } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function requireMember() {
  const session = await readSession();
  if (!session || RoleEngine.isPlatform(session)) redirect("/login");

  const user = await withTenant(session.companyId, (tx) => tx.user.findFirst({
    where: {
      id: session.sub,
      companyId: session.companyId,
      revokedAt: null,
      company: { closedAt: null },
    },
    include: {
      company: true,
      roleAssignments: { orderBy: { assignedAt: "desc" } },
    },
  }));

  if (!user) redirect("/login");

  const activeRoles = user.roleAssignments.filter((role) => role.revokedAt === null);
  if (activeRoles.length === 0) redirect("/login");

  return { session, user, activeRoles };
}

export function hasRole(roles: { role: RoleName }[], role: RoleName): boolean {
  switch (role) {
    case RoleName.OWNER:
      return RoleEngine.isOwner(roles);
    case RoleName.PRODUCTION_MANAGER:
      return RoleEngine.isProductionManager(roles);
    case RoleName.QUALITY_MANAGER:
      return RoleEngine.isQuality(roles);
    case RoleName.OPERATOR:
      return RoleEngine.isOperator(roles);
  }
}

export function canSeeEconomics(roles: { role: RoleName; economicAuthority: boolean }[]): boolean {
  return RoleEngine.hasEconomyAccess(roles);
}

/** Re-export client-safe voice policy (OWNER-only). See @/lib/voice-policy. */
export { canUseVoiceControl } from "@/lib/voice-policy";
