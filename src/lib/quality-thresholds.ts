import type { RoleName } from "@prisma/client";

export const companyQualityDefaults = {
  target: 90,
  warningDelta: 2,
  criticalDelta: 5,
};

export function qualityThresholdsValid(target: number, warningDelta: number, criticalDelta: number) {
  return warningDelta > 0 && warningDelta < criticalDelta && criticalDelta < target && target <= 100;
}

export function resolveQualityThresholds(input: {
  useCompanyDefaults: boolean;
  target: number | null;
  warningDelta: number | null;
  criticalDelta: number | null;
  companyTarget: number;
  companyWarningDelta: number;
  companyCriticalDelta: number;
}) {
  if (input.useCompanyDefaults) {
    return {
      target: input.companyTarget,
      warningDelta: input.companyWarningDelta,
      criticalDelta: input.companyCriticalDelta,
    };
  }
  if (input.target === null || input.warningDelta === null || input.criticalDelta === null) return null;
  return {
    target: input.target,
    warningDelta: input.warningDelta,
    criticalDelta: input.criticalDelta,
  };
}

/** Manage Quality Thresholds. Operators stay denied unless explicitly authorized. */
export function canManageQualityThresholds(roles: { role: RoleName; qualityThresholdAuthority?: boolean }[]) {
  return roles.some((item) =>
    item.role === "OWNER"
    || item.role === "PRODUCTION_MANAGER"
    || item.role === "QUALITY_MANAGER"
    || item.qualityThresholdAuthority === true,
  );
}
