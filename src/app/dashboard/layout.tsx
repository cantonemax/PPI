import { RoleName } from "@prisma/client";
import { CompanyBrand } from "@/app/dashboard/company-mark";
import { DashboardChrome } from "@/app/dashboard/dashboard-chrome";
import { hasRole, requireMember } from "@/lib/access";
import { canManageQualityThresholds } from "@/lib/quality-thresholds";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { promoteDueOrders } from "@/server/order-activation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, user, activeRoles } = await requireMember();
  await promoteDueOrders(session.companyId);
  const owner = hasRole(activeRoles, RoleName.OWNER);
  const planner = owner || hasRole(activeRoles, RoleName.PRODUCTION_MANAGER);
  const floor = owner || hasRole(activeRoles, RoleName.OPERATOR);
  const quality = owner || hasRole(activeRoles, RoleName.QUALITY_MANAGER);
  const operatorOnly = floor && !planner && !quality;
  return (
    <DashboardChrome
      companyName={user.company.name}
      appearance={user.company.appearance === "FLOOR" ? "floor" : "dark"}
      brand={<CompanyBrand />}
      owner={owner}
      planner={planner}
      floor={floor}
      quality={quality}
      operatorOnly={operatorOnly}
      thresholds={canManageQualityThresholds(activeRoles)}
      today={todayLabel()}
      personName={personName(user)}
      personRole={positionLabel(activeRoles)}
    >
      {children}
    </DashboardChrome>
  );
}
