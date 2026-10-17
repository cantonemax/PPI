import { redirect } from "next/navigation";
import { Cockpit } from "@/app/dashboard/operator/cockpit";
import { requireMember } from "@/lib/access";
import { loadCockpitSnapshot } from "@/lib/live-gauge";
import { RoleEngine } from "@/lib/auth/role-engine";

export default async function OperatorPage() {
  const { session, user, activeRoles } = await requireMember();
  const allowed = RoleEngine.canOperate(activeRoles);
  if (!allowed) redirect("/dashboard");
  const snapshot = await loadCockpitSnapshot(session.companyId, user.id);
  return <Cockpit snapshot={snapshot} alarmSound={user.company.alarmSoundEnabled} alarmTone={user.company.alarmTone} criticalScreen={user.company.criticalScreenEnabled} />;
}
