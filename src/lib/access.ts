import { RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { withTenant } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function requireMember() {
  const session = await readSession();
  if (!session) redirect("/login");

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
  return roles.some((item) => item.role === role);
}

export function canSeeEconomics(roles: { role: RoleName; economicAuthority: boolean }[]): boolean {
  return roles.some((item) => item.role === RoleName.OWNER || (item.role === RoleName.PRODUCTION_MANAGER && item.economicAuthority));
}
