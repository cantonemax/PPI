import Link from "next/link";
import { RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { loadFloorStations } from "@/lib/live-gauge";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";

export default async function FloorDeskPage() {
  const { session, user, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER)) redirect("/dashboard");
  const stations = await loadFloorStations(session.companyId);
  return (
    <OwnerFrame companyName={user.company.name} today={todayLabel()} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/floor">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 font-sans">
        <h2 className="text-[26px] font-medium uppercase tracking-[0.08em] text-white">{t("nav.operator")}</h2>
        <p className="text-[14px] text-slate-400">{t("floor.deskHint")}</p>
        {stations.length === 0 ? <p className="text-[14px] text-slate-300">{t("floor.deskEmpty")}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {stations.map((station) => (
              <li key={station.userId}>
                <Link href={`/dashboard/floor/${station.userId}`} className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-[#050d18] p-4 transition hover:border-[#3CF0FF]/50">
                  <p className="text-[20px] text-white">{station.name || t("users.role.OPERATOR")}</p>
                  <p className="text-[13px] uppercase tracking-[0.12em] text-cyan-200">{station.machine || t("floor.noMachine")}</p>
                  <p className="text-[13px] text-slate-300">{station.orderCode ? `${t("order.commessaMark")} ${station.orderCode}` : t("floor.noOrder")}</p>
                  {station.part ? <p className="text-[13px] text-slate-400">{station.part}</p> : null}
                  <p className="mt-auto text-[12px] uppercase tracking-[0.14em] text-cyan-200">{t("floor.openScreen")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OwnerFrame>
  );
}
