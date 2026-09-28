import { notFound, redirect } from "next/navigation";
import { OrderPhase, RoleName } from "@prisma/client";
import { OrderSettingsForm } from "@/app/dashboard/orders/order-settings-form";
import { OrdersShell } from "@/app/dashboard/orders/orders-shell";
import { controlsFromSnapshot } from "@/lib/order-controls";
import { hasRole, requireMember } from "@/lib/access";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { saveOrderSettings } from "@/server/order-actions";

function text(value: { toString(): string } | null | undefined) {
  return value ? value.toString() : "";
}

export default async function OrderSettingsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { session, user, activeRoles } = await requireMember();
  const planner = hasRole(activeRoles, RoleName.OWNER) || hasRole(activeRoles, RoleName.PRODUCTION_MANAGER);
  const operator = hasRole(activeRoles, RoleName.OPERATOR);
  const selectable = { companyId: session.companyId, hiddenAt: null, retiredAt: null };
  const [order, machines, tools, operators] = await withTenant(session.companyId, (tx) => Promise.all([
    tx.productionOrder.findFirst({
      where: { id: orderId, companyId: session.companyId, hiddenAt: null },
      include: {
        part: true,
        estimate: { include: { toolUses: true } },
        controlPlan: { include: { controls: true } },
        drawings: { orderBy: { addedAt: "desc" }, take: 1 },
      },
    }),
    tx.machine.findMany({ where: selectable, orderBy: { name: "asc" } }),
    tx.tool.findMany({ where: selectable, orderBy: { name: "asc" } }),
    tx.user.findMany({
      where: { companyId: session.companyId, revokedAt: null, roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } } },
      orderBy: { email: "asc" },
    }),
  ]));
  if (!order?.estimate || order.phase !== OrderPhase.DRAFT) notFound();
  const allowed = planner || (operator && order.operatorCanEdit && order.assignedOperatorId === user.id);
  if (!allowed) redirect("/dashboard");
  const drawing = order.drawings[0];
  const kind = drawing?.fileName.toLowerCase().endsWith(".pdf") ? "pdf" as const : "image" as const;
  return (
    <OrdersShell title={t("order.settings")} code={order.code?.trim() || order.part.name} today={todayLabel()} person={{ name: personName(user), role: positionLabel(activeRoles) }} view="draft" backHref={planner ? "/dashboard" : "/dashboard/operator/orders"} backLabel={planner ? t("order.back") : t("operator.back")}>
      <OrderSettingsForm
        action={saveOrderSettings}
        orderId={order.id}
        machines={machines.map(({ id, name }) => ({ id, name }))}
        operators={operators.map((operator) => ({ id: operator.id, name: operator.email }))}
        tools={tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description ?? "",
          toolFamily: tool.toolFamily ?? "drill",
          manufacturer: tool.manufacturer ?? "",
          notes: tool.notes ?? "",
        }))}
        drawing={drawing ? { url: `/dashboard/documents/drawing/${drawing.id}?inline=1`, kind } : null}
        defaults={{
          machineId: order.estimate.machineId ?? "",
          operatorId: order.assignedOperatorId ?? "",
          targetQuantity: order.targetQuantity,
          timePerPiece: text(order.estimate.timePerPiece),
          expectedScrap: text(order.estimate.expectedScrap),
          useCompanyDefaults: order.estimate.useCompanyQualityDefaults,
          qualityTarget: text(order.estimate.qualityTargetPercent),
          warningDelta: text(order.estimate.warningDeltaPercent),
          criticalDelta: text(order.estimate.criticalDeltaPercent),
          companyTarget: user.company.defaultQualityTargetPercent.toString(),
          companyWarning: user.company.defaultWarningDeltaPercent.toString(),
          companyCritical: user.company.defaultCriticalDeltaPercent.toString(),
          toolLines: order.estimate.toolUses.map((use) => ({ id: use.toolId, quantity: use.quantity.toString() })),
          controls: controlsFromSnapshot(order.controlPlan?.controls ?? []),
          operatorCanEdit: order.operatorCanEdit,
        }}
        canAuthorize={planner}
      />
    </OrdersShell>
  );
}
