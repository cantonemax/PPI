import { OrderPhase, type TimeUnit } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { personName, positionLabel } from "@/lib/session-identity";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { orderEconomics, productionProgressPercent, scrapPercent as scrapShare } from "@/lib/economics";
import { daysRemaining, deliveryProbability } from "@/lib/delivery-probability";
import { formatDepartmentScore, formatPercent } from "@/lib/kpi/kpi-formatting";
import { currentToolRecord, loadDepartmentGauges, persistedToolLife } from "@/lib/live-gauge";
import { controlIsOverdue, productionDesk, type DeskAlert, type DeskSeverity, type ProductionDeliveryOrder, type ProductionMachine } from "@/lib/production-desk";
import { toolLifeBand } from "@/lib/recommended-action";
import { SPCEngine } from "@/lib/spc/spc-engine";
import { RoleEngine } from "@/lib/auth/role-engine";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const card = "relative flex flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.035] to-transparent p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
const sectionTitle = "text-[12px] uppercase tracking-[0.16em] text-slate-400";
const severityColor: Record<DeskSeverity, string> = { critical: "#FF4D4F", high: "#FF6A3D", medium: "#FF9800", low: "#3CF0FF" };
const toolColor = { replace: "#FF4D4F", check: "#FF9800", ok: "#00E676" };

export default async function ProcessMonitoringPage() {
  const { session, user, activeRoles } = await requireMember();
  if (!RoleEngine.canPlan(activeRoles)) redirect("/dashboard");
  const now = new Date();
  const timeUnit = user.company.timeUnit;
  const picture = await withTenant(session.companyId, async (tx) => {
    const [orders, stopped] = await Promise.all([
      tx.productionOrder.findMany({
        where: { companyId: session.companyId, hiddenAt: null, phase: OrderPhase.IN_PRODUCTION },
        include: {
          part: true,
          actual: true,
          scraps: true,
          estimate: { include: { toolUses: { include: { tool: true } }, materialUses: { include: { material: true } } } },
          machineTimes: { include: { machine: true } },
          toolChanges: { include: { tool: true }, orderBy: { occurredAt: "desc" } },
          materialConsumptions: { include: { material: true } },
          controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" } } } } } },
        },
      }),
      tx.downtime.findMany({
        where: { companyId: session.companyId, endedAt: null },
        include: { machine: true },
        orderBy: { startedAt: "desc" },
      }),
    ]);
    return { orders, stopped };
  });
  const department = await loadDepartmentGauges(session.companyId);
  const machines = machineRows(picture.orders, picture.stopped, timeUnit, now);
  const desk = productionDesk({
    machines,
    orders: deliveryOrders(picture.orders, machines, timeUnit, now),
    departmentScores: department.map((machine) => machine.score),
  });
  const events = [
    ...picture.orders.flatMap((order) => order.machineTimes.map((row) => ({ at: row.startedAt, title: t("process.event.started"), subject: row.machine.name, color: "#00E676" }))),
    ...picture.stopped.map((row) => ({ at: row.startedAt, title: t("process.event.stopped"), subject: row.machine.name, color: "#FF4D4F" })),
    ...picture.orders.flatMap((order) => order.toolChanges.map((row) => ({ at: row.occurredAt, title: t("process.event.tool"), subject: row.tool.name, color: "#FF9800" }))),
    ...picture.orders.flatMap((order) => order.scraps.map((row) => ({ at: row.occurredAt, title: t("process.event.scrap"), subject: order.part.name, color: "#FF4D4F" }))),
  ].sort((left, right) => right.at.getTime() - left.at.getTime()).slice(0, 8);

  const today = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(now);
  const levels: DeskSeverity[] = ["critical", "high", "medium", "low"];
  return (
    <OwnerFrame companyName={user.company.name} today={today} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/process">
      <div className="grid content-start gap-3 px-3 py-3">
        <section id="alerts" className={`${shell} p-3`}>
          <h2 className={sectionTitle}>{t("process.desk.alerts")}</h2>
          <div className="mt-3 grid gap-2 min-[900px]:grid-cols-4">
            {levels.map((level) => (
              <div key={level}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: severityColor[level] }}>{t(`process.desk.severity.${level}`)}</p>
                {desk.alerts[level].length === 0 ? <p className="mt-2 text-[13px] text-slate-500">{t("process.desk.none")}</p> : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {desk.alerts[level].map((alert) => <AlertRow key={`${alert.code}-${alert.machineId}-${alert.orderId}`} alert={alert} />)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className={sectionTitle}>{t("process.desk.machines")}</h2>
          {desk.actionMachines.length === 0 ? <p className="mt-3 text-[13px] text-slate-400">{t("process.normal")}</p> : (
            <div className="mt-2 grid gap-2 min-[800px]:grid-cols-2 min-[1400px]:grid-cols-3">
              {desk.actionMachines.map((machine) => (
                <Link key={machine.id} href={`/dashboard/process/machines/${machine.id}`} className={`${card} transition hover:-translate-y-0.5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{machine.name}</p>
                  <p className="mt-2 text-[18px] font-semibold leading-none" style={{ color: machine.severity ? severityColor[machine.severity] : "#8E9AAB" }}>{machine.labelKey ? t(machine.labelKey) : t("process.running")}</p>
                  <p className="mt-2 truncate text-[13px] text-slate-300">{machine.part || t("dashboard.kpi.empty")}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{machine.orderId ? orderCode(machine.orderId) : t("dashboard.kpi.empty")}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={`${shell} p-3`}>
          <h2 className={sectionTitle}>{t("process.desk.status")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
            <Kpi label={t("process.desk.progress")} value={formatPercent(desk.status.progress)} />
            <Kpi label={t("process.desk.efficiency")} value={formatPercent(desk.status.efficiency)} />
            <Kpi label={t("process.desk.scrapKpi")} value={formatPercent(desk.status.scrap)} />
            <Kpi label={t("process.desk.department")} value={formatDepartmentScore(desk.status.departmentScore)} />
          </div>
        </section>

        <section>
          <h2 className={sectionTitle}>{t("process.desk.tools")}</h2>
          {desk.tools.length === 0 ? <p className="mt-3 text-[13px] text-slate-400">{t("process.empty")}</p> : (
            <ul className="mt-2 grid gap-2 min-[800px]:grid-cols-2">
              {desk.tools.map((tool) => {
                const href = tool.toolId ? `/dashboard/tools/${tool.toolId}` : `/dashboard/process/machines/${tool.machineId}`;
                return (
                  <li key={tool.machineId}>
                    <Link href={href} className={`${card} transition hover:-translate-y-0.5`}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{tool.machineName}</p>
                      <p className="mt-2 text-[22px] font-semibold leading-none" style={{ color: toolColor[tool.band] }}>{formatPercent(tool.life) ?? t("dashboard.kpi.empty")}</p>
                      <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: toolColor[tool.band] }}>{t(`operations.tool.${tool.band}`)}</p>
                      <p className="mt-1 truncate text-[12px] text-slate-400">{tool.toolName || t("operations.toolMissing")}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${shell} p-3`}>
          <h2 className={sectionTitle}>{t("process.desk.delivery")}</h2>
          <div className="mt-3 grid gap-3 min-[900px]:grid-cols-3">
            <DeliveryColumn title={t("process.desk.onSchedule")} tone="#00E676" orders={desk.delivery.onSchedule} />
            <DeliveryColumn title={t("process.desk.atRisk")} tone="#FF9800" orders={desk.delivery.atRisk} />
            <DeliveryColumn title={t("process.desk.late")} tone="#FF4D4F" orders={desk.delivery.late} />
          </div>
        </section>

        <section className={`${shell} p-3`}>
          <h2 className={sectionTitle}>{t("process.timeline")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {events.length === 0 ? <li className="text-[13px] text-slate-400">{t("process.empty")}</li> : null}
            {events.map((event) => (
              <li key={`${event.at.toISOString()}-${event.title}-${event.subject}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: event.color }}>{new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(event.at)}</span>
                <span className="block text-[13px]">{event.title}</span>
                <span className="text-[12px] text-slate-400">{event.subject}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </OwnerFrame>
  );
}

function AlertRow({ alert }: { alert: DeskAlert }) {
  const href = alert.machineId ? `/dashboard/process/machines/${alert.machineId}` : `/dashboard/orders/${alert.orderId}`;
  return (
    <li>
      <Link href={href} className="block rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
        <span className="block text-[13px]" style={{ color: severityColor[alert.severity] }}>{t(alert.labelKey)}</span>
        <span className="text-[12px] text-slate-400">{alert.subject}</span>
      </Link>
    </li>
  );
}

function Kpi({ label, value }: { label: string; value: string | null }) {
  return (
    <p className={card}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="mt-2 block text-[28px] font-semibold leading-none text-white">{value ?? t("dashboard.kpi.empty")}</span>
    </p>
  );
}

function DeliveryColumn({ title, tone, orders }: { title: string; tone: string; orders: ProductionDeliveryOrder[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone }}>{title}</p>
      {orders.length === 0 ? <p className="mt-2 text-[13px] text-slate-500">{t("process.desk.none")}</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/dashboard/orders/${order.id}`} className="block rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                <span className="block text-[13px] text-white">{order.part}</span>
                <span className="text-[12px] text-slate-400">{order.machineName || orderCode(order.id)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DeskOrder = {
  id: string;
  targetQuantity: number;
  plannedDeliveryAt: Date | null;
  part: { name: string };
  actual: { goodQuantity: number } | null;
  scraps: { pieceCount: number; occurredAt: Date }[];
  estimate: {
    timePerPiece: { toString(): string } | null;
    expectedScrap: { toString(): string } | null;
    hourlyRateSnapshot: { toString(): string } | null;
    otherOperationalCost: { toString(): string } | null;
    agreedOperationalValue: { toString(): string } | null;
    toolUses: { toolId: string; quantity: { toString(): string }; unitCost: { toString(): string }; tool: { name: string } }[];
    materialUses: { materialId: string; quantity: { toString(): string }; unitCost: { toString(): string }; material: { name: string } }[];
  } | null;
  machineTimes: { machineId: string; machine: { name: string }; startedAt: Date; endedAt: Date | null; hourlyRateSnapshot: { toString(): string } }[];
  toolChanges: { toolId: string; quantity: { toString(): string }; unitCost: { toString(): string }; occurredAt: Date; tool: { name: string } }[];
  materialConsumptions: { materialId: string; quantity: { toString(): string }; unitCost: { toString(): string }; material: { name: string } }[];
  controlPlan: { controls: { frequency: number; lowerLimit: { toString(): string }; upperLimit: { toString(): string }; measurements: { value: { toString(): string } }[] }[] } | null;
};

function machineRows(orders: DeskOrder[], stopped: { machineId: string; machine: { name: string }; productionOrderId: string | null }[], timeUnit: TimeUnit, now: Date) {
  const stoppedIds = new Set(stopped.map((row) => row.machineId));
  const rows: { id: string; name: string; order: DeskOrder | null; stopped: boolean }[] = [];
  for (const row of stopped) {
    rows.push({
      id: row.machineId,
      name: row.machine.name,
      order: orders.find((order) => order.id === row.productionOrderId) ?? null,
      stopped: true,
    });
  }
  for (const order of orders) {
    for (const interval of order.machineTimes) {
      if (interval.endedAt !== null || stoppedIds.has(interval.machineId) || rows.some((row) => row.id === interval.machineId)) continue;
      rows.push({ id: interval.machineId, name: interval.machine.name, order, stopped: false });
    }
  }
  return rows.map((row) => toMachine(row, timeUnit, now));
}

function toMachine(row: { id: string; name: string; order: DeskOrder | null; stopped: boolean }, timeUnit: TimeUnit, now: Date): ProductionMachine {
  const order = row.order;
  const good = order?.actual?.goodQuantity ?? 0;
  const scrapPieces = order?.scraps.reduce((sum, item) => sum + item.pieceCount, 0) ?? 0;
  const produced = good + scrapPieces;
  const economics = order ? economicsOf(order, timeUnit, now) : null;
  const controls = order?.controlPlan?.controls ?? [];
  const primary = [...controls].sort((left, right) => right.measurements.length - left.measurements.length).find((control) => control.measurements.length > 0) ?? null;
  const planned = order?.estimate?.toolUses.reduce((sum, use) => sum + Number(use.quantity), 0) ?? 0;
  const used = order?.toolChanges.reduce((sum, change) => sum + Number(change.quantity), 0) ?? 0;
  const estimatedTool = order?.estimate?.toolUses[0]?.tool;
  const tool = currentToolRecord(
    (order?.toolChanges ?? []).map((change) => ({ toolId: change.toolId, name: change.tool.name, occurredAt: change.occurredAt.getTime() })),
    estimatedTool ? { toolId: order?.estimate?.toolUses[0]?.toolId ?? "", name: estimatedTool.name } : null,
  );
  return {
    id: row.id,
    name: row.name,
    orderId: order?.id ?? "",
    part: order?.part.name ?? "",
    stopped: row.stopped,
    processRisk: primary ? SPCEngine.activeSpcRisk(primary.measurements.map((item) => Number(item.value)), Number(primary.lowerLimit), Number(primary.upperLimit)) : null,
    controlOverdue: controlIsOverdue(produced, controls.map((control) => ({ frequency: control.frequency, measurements: control.measurements.length }))),
    toolLife: persistedToolLife(planned, used),
    toolId: tool.toolId,
    toolName: tool.name,
    scrapPercent: scrapShare(scrapPieces, produced),
    good,
    target: order?.targetQuantity ?? 0,
    scrapPieces,
    actualTime: economics?.time.actual ?? 0,
    estimatedTime: economics?.time.estimated ?? null,
  };
}

function deliveryOrders(orders: DeskOrder[], machines: ProductionMachine[], timeUnit: TimeUnit, now: Date): ProductionDeliveryOrder[] {
  return orders.flatMap((order) => {
    if (!order.plannedDeliveryAt) return [];
    const machine = machines.find((item) => item.orderId === order.id);
    const economics = economicsOf(order, timeUnit, now);
    const good = order.actual?.goodQuantity ?? 0;
    const life = machine?.toolLife ?? 100;
    const band = toolLifeBand(life);
    const scored = deliveryProbability({
      progress: (productionProgressPercent(good, order.targetQuantity) ?? 0) / 100,
      efficiencyRatio: economics?.time.estimated && economics.time.estimated > 0 ? economics.time.actual / economics.time.estimated : null,
      qualityState: null,
      materialRisk: "none",
      toolRisk: band === "replace" ? "critical" : band === "check" ? "moderate" : "none",
      daysRemaining: daysRemaining(now, order.plannedDeliveryAt),
      estimatedRemainingTime: economics?.time.estimated == null ? 0 : Math.max(0, economics.time.estimated - economics.time.actual),
      timeUnit,
    });
    return [{
      id: order.id,
      part: order.part.name,
      machineName: machine?.name ?? "",
      daysRemaining: daysRemaining(now, order.plannedDeliveryAt),
      band: scored.band,
    }];
  });
}

function economicsOf(order: DeskOrder, timeUnit: TimeUnit, now: Date) {
  if (!order.estimate) return null;
  const estimate = order.estimate;
  return orderEconomics({
    timeUnit,
    targetQuantity: order.targetQuantity,
    timePerPiece: amount(estimate.timePerPiece),
    expectedScrap: amount(estimate.expectedScrap),
    hourlyRateSnapshot: amount(estimate.hourlyRateSnapshot),
    otherOperationalCost: amount(estimate.otherOperationalCost),
    agreedOperationalValue: amount(estimate.agreedOperationalValue),
    estimatedTools: estimate.toolUses.map((use) => ({ id: use.toolId, name: use.tool.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    estimatedMaterials: estimate.materialUses.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    machineTimes: order.machineTimes.map((interval) => ({ hourlyRateSnapshot: Number(interval.hourlyRateSnapshot), startedAt: interval.startedAt, endedAt: interval.endedAt })),
    toolChanges: order.toolChanges.map((change) => ({ id: change.toolId, name: change.tool.name, quantity: Number(change.quantity), unitCost: Number(change.unitCost) })),
    materialConsumptions: order.materialConsumptions.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    scrapPieces: order.scraps.reduce((sum, scrap) => sum + scrap.pieceCount, 0),
    now,
  });
}

function amount(value: { toString(): string } | null | undefined) {
  return value == null ? null : Number(value.toString());
}

function orderCode(id: string) {
  return id.slice(-6).toUpperCase();
}
