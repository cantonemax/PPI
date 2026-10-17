import { notFound, redirect } from "next/navigation";
import { OrderPhase } from "@prisma/client";
import { ResourceForm } from "@/app/dashboard/machines/resource-form";
import { requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hideTool, retireTool, updateTool } from "@/server/resource-actions";
import { ToolHistoryPanel } from "@/app/dashboard/tools/tool-history-panel";
import { toolHistory, toolKpis, type ToolEstimateLine, type ToolHistoryEvent } from "@/lib/tool-history";
import { romeDateTimeLabel } from "@/lib/rome-time";
import { formatCount, formatCurrency } from "@/lib/kpi/kpi-formatting";
import { RoleEngine } from "@/lib/auth/role-engine";

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const { session, activeRoles } = await requireMember();
  const economic = RoleEngine.hasEconomyAccess(activeRoles);
  if (!RoleEngine.canPlan(activeRoles)) redirect("/dashboard");
  const tool = await withTenant(session.companyId, async (tx) => {
    const found = await tx.tool.findFirst({ where: { id: toolId, companyId: session.companyId, hiddenAt: null } });
    if (!found) return null;
    const [uses, changes, estimates, articles, rows] = await Promise.all([
      tx.estimateToolUse.count({ where: { companyId: session.companyId, toolId: found.id } }),
      tx.toolChange.count({ where: { companyId: session.companyId, toolId: found.id } }),
      tx.estimateToolUse.findMany({
        where: { companyId: session.companyId, toolId: found.id },
        include: { estimate: { include: { productionOrder: { select: { partId: true } } } } },
      }),
      tx.articleTool.findMany({ where: { companyId: session.companyId, toolId: found.id }, include: { part: true } }),
      tx.toolChange.findMany({
        where: { companyId: session.companyId, toolId: found.id },
        include: { productionOrder: { include: { part: true } } },
        orderBy: { occurredAt: "desc" },
      }),
    ]);
    return { found, used: uses + changes, estimates, articles, rows };
  });
  if (!tool) notFound();
  const events: ToolHistoryEvent[] = tool.rows.map((row) => ({
    toolId: row.toolId,
    orderId: row.productionOrderId,
    partId: row.productionOrder.partId,
    quantity: Number(row.quantity),
    unitCost: Number(row.unitCost),
    occurredAt: row.occurredAt.getTime(),
    current: row.productionOrder.phase === OrderPhase.IN_PRODUCTION,
  }));
  const estimates: ToolEstimateLine[] = tool.estimates.map((line) => ({
    toolId: line.toolId,
    partId: line.estimate.productionOrder.partId,
    quantity: Number(line.quantity),
  }));
  const kpis = toolKpis(tool.found.id, events, estimates);
  const history = toolHistory(events);
  const money = (value: number) => formatCurrency(value) ?? t("order.none");
  const summary = [
    { label: t("toolHistory.description"), value: tool.found.description || t("order.none") },
    { label: t("toolHistory.parts"), value: tool.articles.map((link) => link.part.name).join(", ") || t("order.none") },
    { label: t("toolHistory.estimated"), value: String(kpis.totalEstimatedConsumption) },
    { label: t("toolHistory.changes"), value: formatCount(kpis.totalToolChanges) ?? "0" },
    { label: t("toolHistory.currentChanges"), value: formatCount(kpis.currentToolChanges) ?? "0" },
    { label: t("toolHistory.first"), value: kpis.firstRecordedChange === null ? t("order.none") : romeDateTimeLabel(new Date(kpis.firstRecordedChange)) },
    { label: t("toolHistory.last"), value: kpis.lastRecordedChange === null ? t("order.none") : romeDateTimeLabel(new Date(kpis.lastRecordedChange)) },
    ...(economic ? [
      { label: t("toolHistory.cost"), value: money(kpis.totalToolCost) },
      { label: t("toolHistory.averageCost"), value: kpis.averageCostPerChange === null ? t("order.none") : money(kpis.averageCostPerChange) },
    ] : []),
  ];
  const historyRows = history.map((event) => {
    const row = tool.rows.find((item) => item.occurredAt.getTime() === event.occurredAt && item.productionOrderId === event.orderId);
    return {
      when: romeDateTimeLabel(new Date(event.occurredAt)),
      order: event.orderId.slice(-6).toUpperCase(),
      part: row?.productionOrder.part.name ?? t("order.none"),
      quantity: String(event.quantity),
      cost: money(event.unitCost),
    };
  });
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
      <ToolHistoryPanel summary={summary} rows={historyRows} showCost={economic} />
    </main>
  );
}
