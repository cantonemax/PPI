import { RoleName } from "@prisma/client";
import { t } from "@/lib/i18n";

const rank = [RoleName.OWNER, RoleName.PRODUCTION_MANAGER, RoleName.QUALITY_MANAGER, RoleName.OPERATOR];

export function personName(user: { firstName: string | null; lastName: string | null }) {
  return [user.firstName, user.lastName].filter((part) => part && part.trim()).join(" ");
}

export function positionLabel(roles: { role: RoleName }[]) {
  const role = rank.find((item) => roles.some((entry) => entry.role === item)) ?? RoleName.OPERATOR;
  return t(`users.role.${role}`);
}

export function todayLabel(now = new Date()) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(now);
}
