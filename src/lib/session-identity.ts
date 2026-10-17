import type { RoleName } from "@prisma/client";
import { RoleEngine } from "@/lib/auth/role-engine";
import { t } from "@/lib/i18n";

export function personName(user: { firstName: string | null; lastName: string | null }) {
  return [user.firstName, user.lastName].filter((part) => part && part.trim()).join(" ");
}

export function positionLabel(roles: { role: RoleName }[]) {
  return t(`users.role.${RoleEngine.getRole(roles)}`);
}

export function todayLabel(now = new Date()) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(now);
}
