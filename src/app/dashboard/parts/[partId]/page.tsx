import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PartForm } from "@/app/dashboard/parts/part-form";
import { requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hidePart, retirePart } from "@/server/part-actions";
import { articleToolKpis, type ToolEstimateLine, type ToolHistoryEvent } from "@/lib/tool-history";
import { formatCurrency } from "@/lib/kpi/kpi-formatting";
import { RoleEngine } from "@/lib/auth/role-engine";

export default async function PartDetailPage({ params }: { params: Promise<{ partId: string }> }) {
  const { partId } = await params;
  const { session, activeRoles } = await requireMember();
  const economic = RoleEngine.hasEconomyAccess(activeRoles);
  if (!RoleEngine.canPlan(activeRoles)) {
    redirect("/dashboard");
  }
  const part = await withTenant(session.companyId, async (tx) => {
    const found = await tx.part.findFirst({
      where: { id: partId, companyId: session.companyId, hiddenAt: null },
      include: { productionOrders: { orderBy: { startedAt: "desc" } }, tools: { include: { tool: true } } },
    });
    if (!found) return null;
    const [changes, estimates] = await Promise.all([
      tx.toolChange.findMany({
        where: { companyId: session.companyId, productionOrder: { partId: found.id } },
      }),
      tx.estimateToolUse.findMany({
        where: { companyId: session.companyId, estimate: { productionOrder: { partId: found.id } } },
      }),
    ]);
    return { found, changes, estimates };
  });
  if (!part) notFound();
  const events: ToolHistoryEvent[] = part.changes.map((change) => ({
    toolId: change.toolId,
    orderId: change.productionOrderId,
    partId: part.found.id,
    quantity: Number(change.quantity),
    unitCost: Number(change.unitCost),
    occurredAt: change.occurredAt.getTime(),
    current: false,
  }));
  const estimateLines: ToolEstimateLine[] = part.estimates.map((line) => ({
    toolId: line.toolId,
    partId: part.found.id,
    quantity: Number(line.quantity),
  }));
  const article = articleToolKpis(part.found.id, events, estimateLines);
  return (
    <main>
      <h1 className="text-3xl">{part.found.name}</h1>
      <p className="mt-2 text-sm text-stone-500">{part.found.retiredAt ? t("part.retired") : t("part.active")}</p>
      <PartForm partId={part.found.id} name={part.found.name} />
      <dl className="mt-4 grid gap-2">
        <div><dt className="text-sm text-stone-500">{t("toolHistory.parts")}</dt><dd>{part.found.tools.map((link) => link.tool.name).join(", ") || t("order.none")}</dd></div>
        <div><dt className="text-sm text-stone-500">{t("toolHistory.articleChanges")}</dt><dd>{article.toolChangesCount}</dd></div>
        <div><dt className="text-sm text-stone-500">{t("toolHistory.articleEstimated")}</dt><dd>{article.estimatedToolUsage}</dd></div>
        {economic ? <div><dt className="text-sm text-stone-500">{t("toolHistory.articleCost")}</dt><dd>{formatCurrency(article.toolCostImpact) ?? t("order.none")}</dd></div> : null}
      </dl>
      <div className="mt-4 flex gap-3">
        {part.found.productionOrders.length > 0 && !part.found.retiredAt ? (
          <form action={retirePart}>
            <input type="hidden" name="partId" value={part.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.retire")}</button>
          </form>
        ) : null}
        {part.found.productionOrders.length === 0 ? (
          <form action={hidePart}>
            <input type="hidden" name="partId" value={part.found.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.hide")}</button>
          </form>
        ) : null}
      </div>
      <h2 className="mt-8 text-xl">{t("part.history")}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {part.found.productionOrders.map((order) => (
          <li key={order.id}>
            <Link href={`/dashboard/orders/${order.id}`}>{t(`order.phase.${order.phase}`)} · {order.targetQuantity}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
