import Link from "next/link";
import { RoleName } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Cockpit } from "@/app/dashboard/operator/cockpit";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { loadCockpitSnapshot } from "@/lib/live-gauge";
import { withTenant } from "@/lib/prisma";
import { personName, todayLabel } from "@/lib/session-identity";

export default async function FloorWatchPage({ params }: { params: Promise<{ userId: string }> }) {
  const { session, user, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER)) redirect("/dashboard");
  const { userId } = await params;
  const station = await withTenant(session.companyId, async (tx) => tx.user.findFirst({
    where: {
      id: userId,
      companyId: session.companyId,
      revokedAt: null,
      roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } },
    },
  }));
  if (!station) notFound();
  const snapshot = await loadCockpitSnapshot(session.companyId, station.id);
  const name = personName(station) || t("users.role.OPERATOR");
  return (
    <div className="ppi-screen bg-stone-100 text-stone-950">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard/floor" className="inline-flex min-h-14 shrink-0 items-center gap-2 text-base">
            <span aria-hidden="true">←</span>
            {t("floor.back")}
          </Link>
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="truncate text-base text-stone-600">{snapshot?.machine || t("floor.noMachine")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="rounded-full border border-stone-300 px-3 py-1 text-[13px]">{t("floor.viewOnly")}</p>
          <p className="rounded-full border border-stone-300 px-3 py-1 text-[13px]">{todayLabel()}</p>
        </div>
      </header>
      <div className="ppi-screen-body px-4 pb-4">
        <Cockpit snapshot={snapshot} readOnly alarmSound={false} criticalScreen={user.company.criticalScreenEnabled} />
      </div>
    </div>
  );
}
