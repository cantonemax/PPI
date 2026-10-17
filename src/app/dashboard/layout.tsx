import { CompanyBrand } from "@/app/dashboard/company-mark";
import { DashboardChrome } from "@/app/dashboard/dashboard-chrome";
import { requireMember } from "@/lib/access";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { promoteDueOrders } from "@/server/order-activation";
import { RoleEngine } from "@/lib/auth/role-engine";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, user, activeRoles } = await requireMember();
  await promoteDueOrders(session.companyId);
  const owner = RoleEngine.isOwner(activeRoles);
  const planner = RoleEngine.canPlan(activeRoles);
  const floor = RoleEngine.canOperate(activeRoles);
  const quality = RoleEngine.canCertify(activeRoles);
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
      thresholds={RoleEngine.hasQualityAccess(activeRoles)}
      today={todayLabel()}
      personName={personName(user)}
      personRole={positionLabel(activeRoles)}
    >
      {children}
    </DashboardChrome>
  );
}
