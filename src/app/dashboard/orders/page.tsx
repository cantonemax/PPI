import { redirect } from "next/navigation";
import { OrderPhase, RoleName } from "@prisma/client";
import { OrderForm } from "@/app/dashboard/orders/order-form";
import { OrderList } from "@/app/dashboard/orders/order-list";
import { OrdersShell } from "@/app/dashboard/orders/orders-shell";
import { controlsFromSnapshot } from "@/lib/order-controls";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { createDraftOrder } from "@/server/order-actions";

function when(value: Date | null) {
  return value ? value.toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "—";
}

function dayKey(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function codeOf(code: string | null, id: string) {
  return code?.trim() || id.slice(-6).toUpperCase();
}

const views = ["draft", "active", "closed", "create"] as const;
type OrderView = (typeof views)[number];

function readView(value: string | undefined): OrderView {
  return views.includes(value as OrderView) ? (value as OrderView) : "active";
}

function phasesFor(view: OrderView): OrderPhase[] {
  if (view === "draft") return [OrderPhase.DRAFT];
  if (view === "closed") return [OrderPhase.COMPLETED];
  return [OrderPhase.IN_PRODUCTION];
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const { session, user, activeRoles } = await requireMember();
  const owner = hasRole(activeRoles, RoleName.OWNER);
  if (!owner && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const params = await searchParams;
  const view = readView(params.view);
  const listError = params.error === "order.activateFailed" ? t("order.activateFailed") : null;
  const orders = view === "create" ? [] : await withTenant(session.companyId, (tx) => tx.productionOrder.findMany({
    where: { companyId: session.companyId, hiddenAt: null, phase: { in: phasesFor(view) } },
    include: { part: true },
    orderBy: { startedAt: "desc" },
  }));
  const parts = view === "create" ? await withTenant(session.companyId, (tx) => tx.part.findMany({
    where: { companyId: session.companyId, hiddenAt: null, retiredAt: null },
    include: { family: { select: { key: true } }, dimensions: { where: { enabled: true }, orderBy: { reference: "asc" } } },
    orderBy: { name: "asc" },
  })) : [];
  return (
    <OrdersShell title={t(`order.${view}`)} today={todayLabel()} person={{ name: personName(user), role: positionLabel(activeRoles) }} view={view}>
          {view === "create" ? (
            <OrderForm
              action={createDraftOrder}
              parts={parts.map((part) => ({
                id: part.id,
                name: part.name,
                family: part.family?.key || part.partType || "",
                controls: controlsFromSnapshot(part.dimensions.map((row) => ({
                  name: `${row.reference} ${row.dimensionName}`,
                  nominal: row.nominal,
                  toleranceKind: row.toleranceKind,
                  upperDeviation: row.upperDeviation,
                  lowerDeviation: row.lowerDeviation,
                  lowerLimit: row.lowerLimit,
                  upperLimit: row.upperLimit,
                  frequency: row.frequency,
                  markerX: row.markerX,
                  markerY: row.markerY,
                }))).map((row) => ({ ...row, placed: false })),
              }))}
            />
          ) : null}
          {listError ? <p className="mb-3 text-[13px] uppercase tracking-[0.08em] text-[#FF4D4F]">{listError}</p> : null}
          {view !== "create" && orders.length === 0 ? <p className="text-[13px] uppercase tracking-[0.12em] text-slate-400">{t("order.empty")}</p> : null}
          {view !== "create" && orders.length > 0 ? (
            <OrderList
              activatable={view === "draft"}
              dateOn={view === "closed" ? "completed" : "started"}
              rows={orders.map((order) => ({
                id: order.id,
                href: `/dashboard/orders/${order.id}`,
                code: codeOf(order.code, order.id),
                article: order.part.name,
                quantity: order.targetQuantity,
                phase: t(`order.phase.${order.phase}`),
                started: when(order.startedAt),
                startedDay: dayKey(order.startedAt),
                completed: when(order.completedAt),
                completedDay: dayKey(order.completedAt),
              }))}
            />
          ) : null}
    </OrdersShell>
  );
}
