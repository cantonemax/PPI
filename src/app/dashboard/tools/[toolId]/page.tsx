import { notFound, redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hideTool, retireTool, updateTool } from "@/server/resource-actions";

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const tool = await withTenant(session.companyId, async (tx) => {
    const found = await tx.tool.findFirst({ where: { id: toolId, companyId: session.companyId, hiddenAt: null } });
    if (!found) return null;
    const [uses, changes] = await Promise.all([
      tx.estimateToolUse.count({ where: { companyId: session.companyId, toolId: found.id } }),
      tx.toolChange.count({ where: { companyId: session.companyId, toolId: found.id } }),
    ]);
    return { found, used: uses + changes };
  });
  if (!tool) notFound();
  return (
    <main>
      <h1 className="text-3xl">{tool.found.name}</h1>
      <p className="mt-2 text-sm text-stone-500">{tool.found.retiredAt ? t("part.retired") : t("part.active")}</p>
      <ResourceForm
        action={updateTool}
        idName="toolId"
        id={tool.found.id}
        name={tool.found.name}
        amountName="unitCost"
        amount={String(tool.found.unitCost)}
        unit={tool.found.unit}
      />
      <div className="mt-4">
        {tool.used > 0 && !tool.found.retiredAt ? (
          <form action={retireTool}>
            <input type="hidden" name="toolId" value={tool.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.retire")}</button>
          </form>
        ) : null}
        {tool.used === 0 ? (
          <form action={hideTool}>
            <input type="hidden" name="toolId" value={tool.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.hide")}</button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
