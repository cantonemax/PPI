import { notFound, redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hideMachine, retireMachine, updateMachine } from "@/server/resource-actions";

export default async function MachinePage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const machine = await withTenant(session.companyId, async (tx) => {
    const found = await tx.machine.findFirst({ where: { id: machineId, companyId: session.companyId, hiddenAt: null } });
    if (!found) return null;
    const [estimates, times, stops] = await Promise.all([
      tx.estimate.count({ where: { companyId: session.companyId, machineId: found.id } }),
      tx.machineTime.count({ where: { companyId: session.companyId, machineId: found.id } }),
      tx.downtime.count({ where: { companyId: session.companyId, machineId: found.id } }),
    ]);
    return { found, used: estimates + times + stops };
  });
  if (!machine) notFound();
  return (
    <main>
      <h1 className="text-3xl">{machine.found.name}</h1>
      <p className="mt-2 text-sm text-stone-500">{machine.found.retiredAt ? t("part.retired") : t("part.active")}</p>
      <ResourceForm
        action={updateMachine}
        idName="machineId"
        id={machine.found.id}
        name={machine.found.name}
        amountName="hourlyRate"
        amount={String(machine.found.hourlyRate)}
      />
      <div className="mt-4">
        {machine.used > 0 && !machine.found.retiredAt ? (
          <form action={retireMachine}>
            <input type="hidden" name="machineId" value={machine.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.retire")}</button>
          </form>
        ) : null}
        {machine.used === 0 ? (
          <form action={hideMachine}>
            <input type="hidden" name="machineId" value={machine.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.hide")}</button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
