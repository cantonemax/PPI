import { RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canSeeEconomics, hasRole } from "@/lib/access";
import { RoleEngine } from "@/lib/auth/role-engine";
import { canManageQualityThresholds } from "@/lib/quality-thresholds";
import { canUseVoiceControl } from "@/lib/voice-policy";

const owner = [{ role: RoleName.OWNER, economicAuthority: false, qualityThresholdAuthority: false }];
const planner = [{ role: RoleName.PRODUCTION_MANAGER, economicAuthority: true, qualityThresholdAuthority: false }];
const plannerPlain = [{ role: RoleName.PRODUCTION_MANAGER, economicAuthority: false, qualityThresholdAuthority: false }];
const quality = [{ role: RoleName.QUALITY_MANAGER, economicAuthority: false, qualityThresholdAuthority: false }];
const operator = [{ role: RoleName.OPERATOR, economicAuthority: false, qualityThresholdAuthority: false }];
const operatorQuality = [{ role: RoleName.OPERATOR, economicAuthority: false, qualityThresholdAuthority: true }];

describe("role engine", () => {
  it("keeps the four company roles and the platform session apart", () => {
    expect(RoleEngine.isOwner(owner)).toBe(true);
    expect(RoleEngine.isProductionManager(planner)).toBe(true);
    expect(RoleEngine.isQuality(quality)).toBe(true);
    expect(RoleEngine.isOperator(operator)).toBe(true);
    expect(RoleEngine.isPlatform({ kind: "platform" })).toBe(true);
    expect(RoleEngine.isPlatform({ kind: "member" })).toBe(false);
    expect(RoleEngine.isOwner(operator)).toBe(false);
    expect(RoleEngine.isOperator(quality)).toBe(false);
  });

  it("keeps economy on the owner and on a production manager with the flag", () => {
    expect(RoleEngine.hasEconomyAccess(owner)).toBe(true);
    expect(RoleEngine.hasEconomyAccess(planner)).toBe(true);
    expect(RoleEngine.hasEconomyAccess(plannerPlain)).toBe(false);
    expect(RoleEngine.hasEconomyAccess(quality)).toBe(false);
    expect(RoleEngine.hasEconomyAccess(operator)).toBe(false);
    expect(canSeeEconomics(owner)).toBe(RoleEngine.hasEconomyAccess(owner));
    expect(canSeeEconomics(plannerPlain)).toBe(false);
  });

  it("keeps quality threshold access on owner, production, quality, or an explicit flag", () => {
    expect(RoleEngine.hasQualityAccess(owner)).toBe(true);
    expect(RoleEngine.hasQualityAccess(plannerPlain)).toBe(true);
    expect(RoleEngine.hasQualityAccess(quality)).toBe(true);
    expect(RoleEngine.hasQualityAccess(operator)).toBe(false);
    expect(RoleEngine.hasQualityAccess(operatorQuality)).toBe(true);
    expect(canManageQualityThresholds(operator)).toBe(false);
    expect(canManageQualityThresholds(operatorQuality)).toBe(true);
  });

  it("sends a single-role home to the same screen as before", () => {
    expect(RoleEngine.homePath(quality)).toBe("/dashboard/quality");
    expect(RoleEngine.homePath(operator)).toBe("/dashboard/operator");
    expect(RoleEngine.homePath(owner)).toBeNull();
    expect(RoleEngine.homePath(planner)).toBeNull();
    expect(RoleEngine.homePath([...quality, ...operator])).toBeNull();
  });

  it("names the same combined gates the pages already used", () => {
    expect(RoleEngine.canPlan(owner)).toBe(true);
    expect(RoleEngine.canPlan(plannerPlain)).toBe(true);
    expect(RoleEngine.canPlan(quality)).toBe(false);
    expect(RoleEngine.canCertify(quality)).toBe(true);
    expect(RoleEngine.canCertify(plannerPlain)).toBe(false);
    expect(RoleEngine.canOperate(operator)).toBe(true);
    expect(RoleEngine.canOperate(owner)).toBe(true);
    expect(RoleEngine.canOperate(plannerPlain)).toBe(false);
    expect(RoleEngine.canRecordMeasurement(operator)).toBe(true);
    expect(RoleEngine.canRecordMeasurement(quality)).toBe(true);
    expect(RoleEngine.canRecordMeasurement(plannerPlain)).toBe(false);
    expect(canUseVoiceControl(owner)).toBe(true);
    expect(canUseVoiceControl(operator)).toBe(false);
    expect(hasRole(owner, RoleName.OWNER)).toBe(true);
    expect(hasRole(operator, RoleName.OWNER)).toBe(false);
  });

  it("picks the same primary role shown on the session label", () => {
    expect(RoleEngine.getRole([...operator, ...owner])).toBe(RoleName.OWNER);
    expect(RoleEngine.getRole([...operator, ...quality])).toBe(RoleName.QUALITY_MANAGER);
    expect(RoleEngine.getRole([])).toBe(RoleName.OPERATOR);
  });
});
