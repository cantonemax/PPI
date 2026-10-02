import Link from "next/link";
import { OrderPhase, RoleName } from "@prisma/client";
import { OrdersShell } from "@/app/dashboard/orders/orders-shell";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { personName, todayLabel } from "@/lib/session-identity";
import { redirect } from "next/navigation";

function mark(id: string) {
  return id.slice(-6).toUpperCase();
}

export default async function OperatorOrdersPage() {
  const { session, user, activeRoles } = await requireMember();
  const allowed = hasRole(activeRoles, RoleName.OPERATOR) || hasRole(activeRoles, RoleName.OWNER);
  if (!allowed) redirect("/dashboard");
  const owner = hasRole(activeRoles, RoleName.OWNER);
  const rows = await withTenant(session.companyId, async (tx) => {
    const current = await tx.user.findFirst({
      where: { id: user.id, companyId: session.companyId },
      include: { activeProductionOrder: { include: { machineTimes: { where: { endedAt: null }, take: 1 } } } },
    });
    const machineId = current?.activeProductionOrder?.machineTimes[0]?.machineId ?? null;
    const orders = await tx.productionOrder.findMany({
      where: {
        companyId: session.companyId,
        hiddenAt: null,
        phase: { in: [OrderPhase.DRAFT, OrderPhase.IN_PRODUCTION] },
        ...(owner ? {} : {
          OR: [
            { assignedOperatorId: user.id },
            { assignedOperatorId: null },
            ...(machineId ? [{ estimate: { is: { machineId } } }] : []),
          ],
        }),
      },
      include: { part: true, estimate: { include: { machine: true } } },
      orderBy: [{ phase: "asc" }, { startedAt: "desc" }],
    });
    return { machineId, orders };
  });
  const mine = rows.orders.filter((order) => order.assignedOperatorId === user.id);
  const open = rows.orders.filter((order) => !order.assignedOperatorId);
  const sent = owner ? rows.orders.filter((order) => order.assignedOperatorId && order.assignedOperatorId !== user.id) : [];
  const onMachine = rows.orders.filter((order) => order.assignedOperatorId && order.assignedOperatorId !== user.id && !sent.includes(order) && order.estimate?.machineId === rows.machineId);
  return (
    <OrdersShell title={t("operator.ordersTitle")} today={todayLabel()} person={{ name: personName(user) || t("users.role.OPERATOR"), role: t("users.role.OPERATOR") }} showCommands={false} backHref="/dashboard/operator" backLabel={t("operator.back")}>
      {rows.orders.length === 0 ? <p className="text-slate-400">{t("operator.empty")}</p> : null}
      <OrderGroup title={t("operator.mine")} orders={mine} />
      <OrderGroup title={t("operator.open")} orders={open} />
      <OrderGroup title={t("operator.sent")} orders={sent} />
      <OrderGroup title={t("operator.onMachine")} orders={onMachine} />
    </OrdersShell>
  );
}

function OrderGroup({ title, orders }: { title: string; orders: { id: string; phase: OrderPhase; part: { name: string }; estimate: { machine: { name: string } | null } | null }[] }) {
  if (orders.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] uppercase tracking-[0.14em] text-cyan-300">{title}</h2>
      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/dashboard/operator/orders/${order.id}`} className="grid grid-cols-[8rem_1fr_10rem_8rem] items-center gap-3 rounded-xl border border-white/10 bg-[#0b1830] px-4 py-3 hover:border-cyan-300/40">
              <span className="text-[18px] tracking-[0.12em]">{mark(order.id)}</span>
              <span>{order.part.name}</span>
              <span className="text-slate-400">{order.estimate?.machine?.name ?? t("order.none")}</span>
              <span className="text-right text-cyan-200">{order.phase === OrderPhase.DRAFT ? t("operator.phase.draft") : t("operator.phase.active")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
