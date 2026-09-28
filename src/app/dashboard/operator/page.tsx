import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { Cockpit } from "@/app/dashboard/operator/cockpit";
import { hasRole, requireMember } from "@/lib/access";
import { loadCockpitSnapshot } from "@/lib/live-gauge";

export default async function OperatorPage() {
  const { session, user, activeRoles } = await requireMember();
  const allowed = hasRole(activeRoles, RoleName.OPERATOR) || hasRole(activeRoles, RoleName.OWNER);
  if (!allowed) redirect("/dashboard");
  const snapshot = await loadCockpitSnapshot(session.companyId, user.id);
  return <Cockpit snapshot={snapshot} alarmSound={user.company.alarmSoundEnabled} alarmTone={user.company.alarmTone} criticalScreen={user.company.criticalScreenEnabled} />;
}
