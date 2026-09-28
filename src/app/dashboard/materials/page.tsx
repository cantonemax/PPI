import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { createMaterial } from "@/server/resource-actions";

export default async function MaterialsPage() {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const materials = await withTenant(session.companyId, (tx) =>
    tx.material.findMany({ where: { companyId: session.companyId, hiddenAt: null }, orderBy: { name: "asc" } }),
  );
  return (
    <main>
      <h1 className="text-3xl">{t("resource.materials")}</h1>
      <ResourceForm action={createMaterial} amountName="unitCost" />
      {materials.length === 0 ? <p className="mt-6">{t("resource.empty")}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {materials.map((material) => (
          <li key={material.id} className="border border-stone-200 bg-white px-3 py-2">
            <Link href={`/dashboard/materials/${material.id}`}>{material.name}</Link>
            <span className="ml-3 text-sm text-stone-500">{material.retiredAt ? t("part.retired") : t("part.active")}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
