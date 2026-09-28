import { redirect } from "next/navigation";
import { ConfigurationCenter } from "@/app/dashboard/settings/configuration-center";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { personName, positionLabel } from "@/lib/session-identity";
import { requireMember } from "@/lib/access";
import { companySignals } from "@/lib/copilot-query";
import { canManageQualityThresholds } from "@/lib/quality-thresholds";
import { withTenant } from "@/lib/prisma";

export default async function SettingsPage() {
  const { session, user, activeRoles } = await requireMember();
  if (!canManageQualityThresholds(activeRoles)) redirect("/dashboard");
  const signals = await companySignals(session.companyId, user.company.timeUnit);
  const picture = await withTenant(session.companyId, async (tx) => {
    const [machines, orders, tools] = await Promise.all([
      tx.machine.findMany({ where: { companyId: session.companyId, hiddenAt: null, retiredAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      tx.productionOrder.findMany({
        where: { companyId: session.companyId, hiddenAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true, estimate: { select: { machineId: true } } },
      }),
      tx.tool.findMany({ where: { companyId: session.companyId, hiddenAt: null, retiredAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return { machines, orders, tools };
  });
  const today = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(new Date());
  return (
    <OwnerFrame companyName={user.company.name} today={today} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/settings">
      <ConfigurationCenter
        defaults={{
          target: user.company.defaultQualityTargetPercent.toString(),
          warningDelta: user.company.defaultWarningDeltaPercent.toString(),
          criticalDelta: user.company.defaultCriticalDeltaPercent.toString(),
        }}
        machines={picture.machines}
        orders={picture.orders.map((order) => ({
          id: order.id,
          label: order.id.slice(-6).toUpperCase(),
          machineId: order.estimate?.machineId ?? "",
        }))}
        tools={picture.tools}
      />
    </OwnerFrame>
  );
}
