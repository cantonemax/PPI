import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { createTool } from "@/server/resource-actions";

export default async function ToolsPage() {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const tools = await withTenant(session.companyId, (tx) =>
    tx.tool.findMany({ where: { companyId: session.companyId, hiddenAt: null }, orderBy: { name: "asc" } }),
  );
  return (
    <main>
      <h1 className="text-3xl">{t("resource.tools")}</h1>
      <ResourceForm action={createTool} amountName="unitCost" toolIdentity />
      {tools.length === 0 ? <p className="mt-6">{t("resource.empty")}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {tools.map((tool) => (
          <li key={tool.id} className="border border-stone-200 bg-white px-3 py-2">
            <Link href={`/dashboard/tools/${tool.id}`}>{tool.name}</Link>
            <span className="ml-3 text-sm text-stone-500">{tool.retiredAt ? t("part.retired") : t("part.active")}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
