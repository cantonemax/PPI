import { RoleName } from "@prisma/client";

export type RoleGrant = {
  role: RoleName;
  economicAuthority?: boolean;
  qualityThresholdAuthority?: boolean;
};

const rank = [RoleName.OWNER, RoleName.PRODUCTION_MANAGER, RoleName.QUALITY_MANAGER, RoleName.OPERATOR];

function holds(roles: { role: RoleName }[], role: RoleName) {
  return roles.some((item) => item.role === role);
}

export const RoleEngine = {
  isOperator(roles: { role: RoleName }[]) {
    return holds(roles, RoleName.OPERATOR);
  },

  isQuality(roles: { role: RoleName }[]) {
    return holds(roles, RoleName.QUALITY_MANAGER);
  },

  isProductionManager(roles: { role: RoleName }[]) {
    return holds(roles, RoleName.PRODUCTION_MANAGER);
  },

  isOwner(roles: { role: RoleName }[]) {
    return holds(roles, RoleName.OWNER);
  },

  isPlatform(session: { kind?: string } | null | undefined) {
    return session?.kind === "platform";
  },

  hasEconomyAccess(roles: RoleGrant[]) {
    return roles.some((item) => item.role === RoleName.OWNER || (item.role === RoleName.PRODUCTION_MANAGER && item.economicAuthority === true));
  },

  hasQualityAccess(roles: RoleGrant[]) {
    return roles.some((item) => item.role === RoleName.OWNER || item.role === RoleName.PRODUCTION_MANAGER || item.role === RoleName.QUALITY_MANAGER || item.qualityThresholdAuthority === true);
  },

  canPlan(roles: { role: RoleName }[]) {
    return RoleEngine.isOwner(roles) || RoleEngine.isProductionManager(roles);
  },

  canCertify(roles: { role: RoleName }[]) {
    return RoleEngine.isOwner(roles) || RoleEngine.isQuality(roles);
  },

  canOperate(roles: { role: RoleName }[]) {
    return RoleEngine.isOwner(roles) || RoleEngine.isOperator(roles);
  },

  canRecordMeasurement(roles: { role: RoleName }[]) {
    return RoleEngine.canOperate(roles) || RoleEngine.isQuality(roles);
  },

  getRole(roles: { role: RoleName }[]) {
    return rank.find((item) => holds(roles, item)) ?? RoleName.OPERATOR;
  },

  homePath(roles: { role: RoleName }[]) {
    if (!RoleEngine.canPlan(roles) && RoleEngine.isQuality(roles) && !RoleEngine.isOperator(roles)) return "/dashboard/quality";
    if (!RoleEngine.canPlan(roles) && !RoleEngine.isQuality(roles) && RoleEngine.isOperator(roles)) return "/dashboard/operator";
    return null;
  },
};
