import { OrderPhase, RoleName } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { personName, positionLabel } from "@/lib/session-identity";
import { hasRole, requireMember } from "@/lib/access";
import { companySignals } from "@/lib/copilot-query";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";

const card = "relative flex flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.035] to-transparent p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5";

export default async function CopilotPage() {
  const { session, user, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const signals = await companySignals(session.companyId, user.company.timeUnit);
  const picture = await withTenant(session.companyId, async (tx) => {
    const [orders, running, stopped] = await Promise.all([
      tx.productionOrder.findMany({
        where: { companyId: session.companyId, hiddenAt: null, phase: OrderPhase.IN_PRODUCTION },
        include: { part: true, actual: true, scraps: true },
      }),
      tx.machineTime.findMany({
        where: { companyId: session.companyId, endedAt: null, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } },
        include: { machine: true, productionOrder: { include: { part: true } } },
        orderBy: { startedAt: "desc" },
      }),
      tx.downtime.findMany({
        where: { companyId: session.companyId, endedAt: null },
        include: { machine: true, productionOrder: { include: { part: true } } },
        orderBy: { startedAt: "desc" },
      }),
    ]);
    return { orders, running, stopped };
  });
  const stoppedIds = new Set(picture.stopped.map((row) => row.machineId));
  const machines = [
    ...picture.stopped.map((row) => ({ id: row.id, machineId: row.machineId, name: row.machine.name, orderId: row.productionOrderId, part: row.productionOrder.part.name, stopped: true })),
    ...picture.running.filter((row) => !stoppedIds.has(row.machineId)).map((row) => ({ id: row.id, machineId: row.machineId, name: row.machine.name, orderId: row.productionOrderId, part: row.productionOrder.part.name, stopped: false })),
  ];
  const today = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(new Date());
  return (
    <OwnerFrame companyName={user.company.name} today={today} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/copilot">
      <div className="px-3 py-3">
        <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("process.machines")}</h2>
        {machines.length === 0 ? <p className="mt-4 text-[13px] text-slate-400">{t("process.empty")}</p> : (
          <div className="mt-2 grid grid-cols-3 gap-3">
            {machines.map((machine) => {
              const related = signals.filter((signal) => signal.orderId === machine.orderId && signal.severity !== "info");
              const critical = machine.stopped || related.some((signal) => signal.severity === "critical");
              const attention = !critical && related.length > 0;
              const color = critical ? "#FF4D4F" : attention ? "#FF9800" : "#00E676";
              const status = machine.stopped ? t("process.stopped") : critical ? t("dashboard.processWord.critical") : attention ? t("dashboard.processWord.attention") : t("process.running");
              const alerts = `${related.length} ${related.length === 1 ? t("workspace.alertOne") : t("workspace.alertMany")}`;
              return (
                <Link key={machine.id} href={`/dashboard/process/machines/${machine.machineId}`} className={card}>
                  <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-cyan-200/30" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[22px] font-semibold leading-none text-white">{machine.name}</p>
                      <p className="mt-2 truncate text-[13px] text-slate-300">{machine.part}</p>
                      <p className="mt-1 text-[12px] tracking-[0.12em] text-slate-400">{machine.orderId.slice(-6).toUpperCase()}</p>
                    </div>
                    <HealthRing color={color} pulse={critical} />
                  </div>
                  <p className="mt-3 text-[30px] font-semibold leading-none text-white">{progressOf(picture.orders, machine.orderId)}</p>
                  <p className="mt-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
                    <StatusDot color={color} pulse={critical} />
                    {status}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">{t("process.eta")} {completionOf(picture.orders, machine.orderId)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">{alerts}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </OwnerFrame>
  );
}

function HealthRing({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0" aria-hidden="true" style={pulse ? { animation: "ppi-soft-pulse 2.8s ease-in-out infinite" } : undefined}>
      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="88 88" transform="rotate(-90 18 18)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function StatusDot({ color, pulse }: { color: string; pulse: boolean }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}`, animation: pulse ? "ppi-soft-pulse 2.8s ease-in-out infinite" : undefined }} />;
}

function progressOf(orders: { id: string; actual: { goodQuantity: number } | null; scraps: { pieceCount: number }[] }[], orderId: string) {
  const order = orders.find((item) => item.id === orderId);
  if (!order) return t("dashboard.kpi.empty");
  const produced = (order.actual?.goodQuantity ?? 0) + order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
  const good = order.actual?.goodQuantity ?? 0;
  if (produced <= 0) return t("dashboard.kpi.empty");
  return `${Math.round((good / produced) * 100)}%`;
}

function completionOf(orders: { id: string; plannedDeliveryAt: Date | null }[], orderId: string) {
  const order = orders.find((item) => item.id === orderId);
  if (!order?.plannedDeliveryAt) return t("dashboard.kpi.empty");
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" }).format(order.plannedDeliveryAt);
}
