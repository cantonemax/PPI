import { notFound, redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hideMaterial, retireMaterial, updateMaterial } from "@/server/resource-actions";

export default async function MaterialPage({ params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params;
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const material = await withTenant(session.companyId, async (tx) => {
    const found = await tx.material.findFirst({
      where: { id: materialId, companyId: session.companyId, hiddenAt: null },
    });
    if (!found) return null;
    const [uses, consumptions] = await Promise.all([
      tx.estimateMaterialUse.count({ where: { companyId: session.companyId, materialId: found.id } }),
      tx.materialConsumption.count({ where: { companyId: session.companyId, materialId: found.id } }),
    ]);
    return { found, used: uses + consumptions };
  });
  if (!material) notFound();
  return (
    <main>
      <h1 className="text-3xl">{material.found.name}</h1>
      <p className="mt-2 text-sm text-stone-500">{material.found.retiredAt ? t("part.retired") : t("part.active")}</p>
      <ResourceForm
        action={updateMaterial}
        idName="materialId"
        id={material.found.id}
        name={material.found.name}
        amountName="unitCost"
        amount={String(material.found.unitCost)}
        unit={material.found.unit}
      />
      <div className="mt-4">
        {material.used > 0 && !material.found.retiredAt ? (
          <form action={retireMaterial}>
            <input type="hidden" name="materialId" value={material.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.retire")}</button>
          </form>
        ) : null}
        {material.used === 0 ? (
          <form action={hideMaterial}>
            <input type="hidden" name="materialId" value={material.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.hide")}</button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
