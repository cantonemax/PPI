import { notFound, redirect } from "next/navigation";
import { OrderPhase, Prisma, RoleName } from "@prisma/client";
import { OperatorDrawing } from "@/app/dashboard/operator/orders/order-drawing";
import { OrdersShell } from "@/app/dashboard/orders/orders-shell";
import { hasRole, requireMember } from "@/lib/access";
import { drawingReferences, type DrawingMarker } from "@/lib/drawing-references";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { personName, todayLabel } from "@/lib/session-identity";
import { operatorCompleteOrder, operatorStartOrder, setActiveOrder } from "@/server/floor-actions";

export default async function OperatorOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { orderId } = await params;
  const { error } = await searchParams;
  const { session, user, activeRoles } = await requireMember();
  const allowed = hasRole(activeRoles, RoleName.OPERATOR) || hasRole(activeRoles, RoleName.OWNER);
  if (!allowed) redirect("/dashboard");
  const owner = hasRole(activeRoles, RoleName.OWNER);
  const order = await withTenant(session.companyId, async (tx) => {
    const current = await tx.user.findFirst({
      where: { id: user.id, companyId: session.companyId },
      include: { activeProductionOrder: { include: { machineTimes: { where: { endedAt: null }, take: 1 } } } },
    });
    const machineId = current?.activeProductionOrder?.machineTimes[0]?.machineId ?? null;
    const visible: Prisma.ProductionOrderWhereInput[] = [
      { assignedOperatorId: owner ? { not: null } : user.id },
      { id: orderId, phase: OrderPhase.COMPLETED },
    ];
    if (machineId) visible.push({ estimate: { is: { machineId } } });
    return tx.productionOrder.findFirst({
      where: {
        id: orderId,
        companyId: session.companyId,
        hiddenAt: null,
        OR: visible,
      },
      include: {
        part: true,
        estimate: { include: { machine: true } },
        drawings: { orderBy: { addedAt: "desc" }, take: 1 },
        controlPlan: { include: { controls: true } },
      },
    });
  });
  if (!order) notFound();
  const drawing = order.drawings[0];
  const drawingView = drawing
    ? { url: `/dashboard/documents/drawing/${drawing.id}?inline=1`, kind: drawing.fileName.toLowerCase().endsWith(".pdf") ? "pdf" as const : "image" as const }
    : null;
  const checks = (order.controlPlan?.controls ?? []).map((control, index) => {
    const prefixed = drawingReferences.find((letter) => control.name.startsWith(`${letter} `));
    const reference = prefixed ?? drawingReferences[index] ?? "A";
    return {
      id: control.id,
      reference,
      callout: prefixed ? control.name.slice(reference.length + 1) : control.name,
      nominal: control.nominal.toString(),
      lower: control.lowerLimit.toString(),
      upper: control.upperLimit.toString(),
      x: control.markerX === null ? null : Number(control.markerX),
      y: control.markerY === null ? null : Number(control.markerY),
    };
  });
  const markers: DrawingMarker[] = checks.flatMap((row) => (row.x === null || row.y === null ? [] : [{ reference: row.reference, x: row.x, y: row.y }]));
  const mine = order.assignedOperatorId === user.id;
  const active = user.activeProductionOrderId === order.id;
  const code = order.id.slice(-6).toUpperCase();
  return (
    <OrdersShell title={order.part.name} code={code} today={todayLabel()} person={{ name: personName(user) || t("users.role.OPERATOR"), role: t("users.role.OPERATOR") }} showCommands={false} backHref="/dashboard/operator/orders" backLabel={t("operator.orders")}>
      {error ? <p className="mb-3 text-[#FF4D4F]">{t(error)}</p> : null}
      <p className="mb-4 text-slate-400">{order.estimate?.machine?.name ?? t("order.none")} · {order.phase === OrderPhase.DRAFT ? t("operator.phase.draft") : order.phase === OrderPhase.IN_PRODUCTION ? t("operator.phase.active") : t("order.closed")}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {mine && order.phase === OrderPhase.DRAFT ? (
          <form action={operatorStartOrder}><input type="hidden" name="orderId" value={order.id} /><button className="rounded-full bg-blue-800 px-4 py-2 text-white">{t("operator.start")}</button></form>
        ) : null}
        {order.phase === OrderPhase.IN_PRODUCTION && (mine || active) ? (
          <form action={operatorCompleteOrder}><input type="hidden" name="orderId" value={order.id} /><button className="rounded-full border border-[#FF4D4F]/50 px-4 py-2 text-[#FF4D4F]">{t("operator.complete")}</button></form>
        ) : null}
        {order.phase === OrderPhase.IN_PRODUCTION && !active ? (
          <form action={setActiveOrder}><input type="hidden" name="orderId" value={order.id} /><button className="rounded-full border border-cyan-300/40 px-4 py-2 text-cyan-100">{t("operator.resume")}</button></form>
        ) : null}
      </div>
      <section className="rounded-xl border border-white/10 bg-[#0b1830] p-4">
        <h2 className="mb-3 text-[13px] uppercase tracking-[0.14em] text-cyan-300">{t("order.drawing")}</h2>
        <OperatorDrawing drawing={drawingView} markers={markers} />
        <ul className="mt-4 flex flex-col gap-3">
          {checks.map((row) => (
            <li key={row.id} className="grid grid-cols-[4rem_1fr] items-center gap-4 rounded-xl border border-white/10 bg-[#07101c] px-4 py-4">
              <span className="grid h-16 w-16 place-items-center rounded-full border border-[#3CF0FF] text-[26px] font-semibold text-[#3CF0FF]">{row.reference}</span>
              <div className="min-w-0">
                <p className="text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("operator.measure.check")}</p>
                <p className="text-[26px] font-medium leading-tight text-white">{row.callout}</p>
                <p className="mt-2 text-[18px] leading-snug text-[#3CF0FF]">{`${t("operator.measure.nominal")} ${row.nominal}`}</p>
                <p className="text-[18px] leading-snug text-[#3CF0FF]">{`${t("operator.measure.tolerance")} ${row.lower} – ${row.upper}`}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </OrdersShell>
  );
}
