import { OrderPhase, RoleName } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole, requireMember } from "@/lib/access";
import { type CopilotSignal } from "@/lib/copilot";
import { companySignals } from "@/lib/copilot-query";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { personName, positionLabel } from "@/lib/session-identity";
import { InfoTip } from "@/app/dashboard/info-tip";
import { loadDepartmentGauges } from "@/lib/live-gauge";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const card = "relative flex flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.035] to-transparent p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
const tile = `${card} h-[280px]`;
const kicker = "h-8 shrink-0 text-center text-[11px] font-medium uppercase leading-4 tracking-[0.22em] text-slate-500";
const sectionTitle = "text-[12px] uppercase tracking-[0.16em] text-slate-400";

export default async function ProcessMonitoringPage() {
  const { session, user, activeRoles } = await requireMember();
  const owner = hasRole(activeRoles, RoleName.OWNER);
  const planner = owner || hasRole(activeRoles, RoleName.PRODUCTION_MANAGER);
  if (!planner) redirect("/dashboard");
  const signals = await companySignals(session.companyId, user.company.timeUnit);
  const picture = await withTenant(session.companyId, async (tx) => {
    const [orders, running, stopped, tools, scraps, materials] = await Promise.all([
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
      tx.toolChange.findMany({
        where: { companyId: session.companyId },
        include: { tool: true },
        orderBy: { occurredAt: "desc" },
        take: 8,
      }),
      tx.scrap.findMany({
        where: { companyId: session.companyId },
        include: { productionOrder: { include: { part: true } } },
        orderBy: { occurredAt: "desc" },
        take: 8,
      }),
      tx.materialConsumption.findMany({
        where: { companyId: session.companyId },
        include: { material: true },
        orderBy: { occurredAt: "desc" },
        take: 8,
      }),
    ]);
    return { orders, running, stopped, tools, scraps, materials };
  });
  const critical = signals.filter((signal) => signal.severity === "critical").length;
  const department = await loadDepartmentGauges(session.companyId);
  const scored = department.filter((machine) => machine.score !== null);
  const score = scored.length === 0 ? null : Math.round(scored.reduce((sum, machine) => sum + (machine.score ?? 0), 0) / scored.length);
  const status = score === null ? "empty" : score >= 80 ? "stable" : score >= 60 ? "attention" : "critical";
  const color = status === "critical" ? "#FF4D4F" : status === "attention" ? "#FF9800" : status === "stable" ? "#00E676" : "#8E9AAB";
  const stoppedIds = new Set(picture.stopped.map((row) => row.machineId));
  const warnedOrders = new Set(signals.filter((signal) => signal.severity !== "info").map((signal) => signal.orderId));
  const events = [
    ...picture.running.map((row) => ({ at: row.startedAt, title: t("process.event.started"), subject: row.machine.name, color: "#00E676" })),
    ...picture.stopped.map((row) => ({ at: row.startedAt, title: t("process.event.stopped"), subject: row.machine.name, color: "#FF4D4F" })),
    ...picture.tools.map((row) => ({ at: row.occurredAt, title: t("process.event.tool"), subject: row.tool.name, color: "#FF9800" })),
    ...picture.scraps.map((row) => ({ at: row.occurredAt, title: t("process.event.scrap"), subject: row.productionOrder.part.name, color: "#FF4D4F" })),
    ...picture.materials.map((row) => ({ at: row.occurredAt, title: t("process.event.material"), subject: row.material.name, color: "#3CF0FF" })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime()).slice(0, 12);
  const attentionMachines = picture.stopped.length + picture.running.filter((row) => !stoppedIds.has(row.machineId) && warnedOrders.has(row.productionOrderId)).length;
  const qualityAlerts = signals.filter((signal) => signal.kind === "quality").length;
  const toolAlerts = signals.filter((signal) => signal.kind === "tooling").length;
  const statusWord = status === "critical" ? t("dashboard.processWord.critical") : status === "attention" ? t("dashboard.processWord.attention") : status === "stable" ? t("dashboard.processWord.stable") : t("dashboard.kpi.empty");
  const trendWord = status === "critical" ? t("process.trend.declining") : t("process.trend.stable");
  const nextAction = signals.find((signal) => signal.severity === "critical") ?? signals[0];
  const groups = [
    [t("process.group.quality"), signals.filter((signal) => signal.kind === "quality")],
    [t("process.group.tools"), signals.filter((signal) => signal.kind === "tooling")],
    [t("process.group.materials"), signals.filter((signal) => signal.code === "materialSuggestion")],
    [t("process.group.machines"), signals.filter((signal) => signal.code === "downtime")],
    [t("process.group.delivery"), signals.filter((signal) => signal.code === "time")],
  ] as const;
  const attentionLine = `${attentionMachines} ${attentionMachines === 1 ? t("process.machineAttentionOne") : t("process.machineAttentionMany")}`;
  const alertLine = `${qualityAlerts} ${qualityAlerts === 1 ? t("process.qualityAlertOne") : t("process.qualityAlertMany")} · ${toolAlerts} ${toolAlerts === 1 ? t("process.toolAlertOne") : t("process.toolAlertMany")}`;
  const runningMachines = picture.running.filter((row) => !stoppedIds.has(row.machineId));
  const plannedOrders = picture.orders.filter((order) => order.plannedDeliveryAt).length;

  const today = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(new Date());
  return (
    <OwnerFrame companyName={user.company.name} today={today} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/process">
    <div className="grid gap-3 px-3 py-3 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-3">
      <section>
        <h2 className={sectionTitle}>{t("process.machines")}</h2>
        {picture.stopped.length === 0 && runningMachines.length === 0 ? <p className="mt-4 text-[13px] text-slate-400">{t("process.empty")}</p> : (
          <div className="mt-2 grid grid-cols-2 gap-2 min-[1500px]:grid-cols-3">
            {picture.stopped.map((row) => <MachineLink key={row.id} machineId={row.machineId} name={row.machine.name} orderId={row.productionOrderId} part={row.productionOrder.part.name} state={t("process.stopped")} stateColor="#FF4D4F" progress={progressOf(picture.orders, row.productionOrderId)} completion={completionOf(picture.orders, row.productionOrderId)} />)}
            {runningMachines.map((row) => {
              const warning = warnedOrders.has(row.productionOrderId);
              return <MachineLink key={row.id} machineId={row.machineId} name={row.machine.name} orderId={row.productionOrderId} part={row.productionOrder.part.name} state={warning ? t("process.warning") : t("process.running")} stateColor={warning ? "#FF9800" : "#00E676"} progress={progressOf(picture.orders, row.productionOrderId)} completion={completionOf(picture.orders, row.productionOrderId)} />;
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className={sectionTitle}>{t("process.activeOrders")}</h2>
        {picture.orders.length === 0 ? <p className="mt-4 text-center text-[13px] text-slate-400">{t("process.empty")}</p> : (
          <div className="mt-2 grid grid-cols-2 gap-2 min-[1500px]:grid-cols-3">
            {picture.orders.map((order) => {
              const machine = picture.running.find((row) => row.productionOrderId === order.id) ?? picture.stopped.find((row) => row.productionOrderId === order.id);
              const produced = (order.actual?.goodQuantity ?? 0) + order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
              const good = order.actual?.goodQuantity ?? 0;
              const progress = produced > 0 ? Math.round((good / produced) * 100) : 0;
              const orderSignals = signals.filter((signal) => signal.orderId === order.id && signal.severity !== "info");
              const orderCritical = orderSignals.some((signal) => signal.severity === "critical");
              const orderTone = orderCritical ? "#FF4D4F" : orderSignals.length > 0 ? "#FF9800" : "#00E676";
              const orderStatus = orderCritical ? t("dashboard.processWord.critical") : orderSignals.length > 0 ? t("dashboard.processWord.attention") : t("dashboard.processWord.stable");
              const eta = order.plannedDeliveryAt
                ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" }).format(order.plannedDeliveryAt)
                : t("dashboard.kpi.empty");
              return (
                <article key={order.id} className={card}>
                  <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-cyan-200/30" />
                  <p className={kicker}>{order.part.name}</p>
                  <p className="mt-2 text-center text-[22px] font-semibold leading-none tracking-tight text-white">{produced > 0 ? `${progress}%` : t("dashboard.kpi.empty")}</p>
                  <p className="mt-3 h-5 text-center text-[13px] font-semibold uppercase leading-5 tracking-[0.16em]" style={{ color: orderTone }}>{orderStatus}</p>
                  <p className="mt-2 text-center text-[12px] uppercase tracking-[0.12em] text-slate-300">{t("process.eta")} · {eta}</p>
                  <p className="mt-2 truncate text-center text-[11px] text-slate-400">{machine?.machine.name ?? t("dashboard.kpi.empty")}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>
      <aside className="grid content-start gap-3 min-[1100px]:sticky min-[1100px]:top-3 min-[1100px]:max-h-[calc(100dvh-5.5rem)] min-[1100px]:self-start min-[1100px]:overflow-y-auto">
      <section className={`relative ${shell} p-3`}>
        <InfoTip title={t("dashboard.process")} text={t("dashboard.hint.process")} />
        <h2 className={sectionTitle}>{t("dashboard.process")}</h2>
        <p className="mt-3 text-[36px] font-semibold leading-none" style={{ color }}>{score ?? t("dashboard.kpi.empty")}{score !== null ? <span className="text-[13px] text-slate-500"> / 100</span> : null}</p>
        <p className="mt-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color }}><StatusMark color={color} />{statusWord}</p>
        <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>{trendWord}</p>
        <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-slate-200">{attentionMachines > 0 ? attentionLine : t("process.normal")}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-400">{alertLine}</p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">{t("process.nextAction")}</p>
        <p className="text-[12px] text-slate-200">{nextAction ? advice(nextAction) : t("process.normal")}</p>
      </section>
      <section id="alerts" className={`${shell} p-3`}>
        <h2 className={sectionTitle}>{t("process.alerts")}</h2>
        {groups.every(([, rows]) => rows.length === 0) ? <p className="mt-4 text-center text-[13px] text-slate-400">{t("process.normal")}</p> : (
          <ul className="mt-2 flex flex-col gap-2">
            {groups.filter(([, rows]) => rows.length > 0).flatMap(([name, rows]) => rows.map((signal) => {
              const tone = signal.severity === "critical" ? "#FF4D4F" : signal.severity === "warning" ? "#FF9800" : "#3CF0FF";
              const word = signal.severity === "critical" ? t("dashboard.processWord.critical") : signal.severity === "warning" ? t("dashboard.processWord.attention") : t("process.observation");
              return (
                <li key={`${name}-${signal.orderId}-${signal.code}-${signal.subject}`}>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                    <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: tone }}>{name}</span>
                    <span className="block text-[13px]">{word}</span>
                    <span className="text-[12px] text-slate-400">{signal.subject} · {advice(signal)}</span>
                  </div>
                </li>
              );
            }))}
          </ul>
        )}
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
      <section className={`${shell} p-3`}>
        <h2 className={sectionTitle}>{t("process.productionSummary")}</h2>
        <div className="mt-3 grid grid-cols-3 text-center">
          <p><span className="block text-[36px] font-semibold leading-none">{picture.orders.length}</span><span className="text-[11px] text-slate-400">{t("process.ordersWord")}</span></p>
          <p><span className="block text-[36px] font-semibold leading-none">{runningMachines.length}</span><span className="text-[11px] text-slate-400">{t("process.machinesOrders")}</span></p>
          <p><span className="block text-[36px] font-semibold leading-none">{attentionMachines}</span><span className="text-[11px] text-slate-400">{t("dashboard.processWord.attention")}</span></p>
        </div>
      </section>
      <section className="flex h-[220px] flex-col justify-between rounded-2xl border border-dashed border-white/15 bg-[#0c1c30]/50 p-3">
        <h2 className={sectionTitle}>{t("process.planningSummary")}</h2>
        <p className="text-center text-[13px] text-slate-400">{plannedOrders > 0 ? String(plannedOrders) : t("dashboard.planEmpty")}</p>
        <p className="text-[12px] text-slate-500">{t("process.activeOrders")} · {picture.orders.length}</p>
      </section>
      </aside>
    </div>
    </OwnerFrame>
  );
}

function MachineLink({ machineId, name, orderId, part, state, stateColor, progress, completion }: { machineId: string; name: string; orderId: string; part: string; state: string; stateColor: string; progress: string; completion: string }) {
  return (
    <Link href={`/dashboard/process/machines/${machineId}`} className={`${card} transition hover:-translate-y-0.5`}>
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-cyan-200/30" />
      <p className={kicker}>{name}</p>
      <p className="mt-1 text-center text-[13px] tracking-wide text-slate-200">{orderCode(orderId)}</p>
      <p className="text-center text-[12px] text-slate-400">{part}</p>
      <p className="mt-2 text-center text-[30px] font-semibold leading-none text-white">{progress}</p>
      <p className="mt-2 text-center text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: stateColor }}>{state}</p>
      <p className="mt-2 text-center text-[11px] uppercase tracking-[0.08em] text-slate-400">{t("process.estimatedCompletion")} · {completion}</p>
    </Link>
  );
}

function orderCode(id: string) {
  return id.slice(-6).toUpperCase();
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

function MachineTile({ name, state, stateColor, order, runtime }: { name: string; state: string; stateColor: string; order: string; runtime: string }) {
  return (
    <article className={`${tile} w-full max-w-[360px]`}>
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-cyan-200/30" />
      <p className={kicker}>{name}</p>
      <p className="mt-3 text-center text-[30px] font-semibold uppercase leading-none tracking-tight" style={{ color: stateColor }}>{state}</p>
      <p className="mt-4 h-5 text-center text-[13px] font-semibold uppercase leading-5 tracking-[0.16em] text-slate-300">{t("dashboard.trend.empty")}</p>
      <BaselineWave />
      <p className="mt-auto h-8 truncate pt-3 text-center text-[11px] text-slate-400">{`${order} · ${runtime}`}</p>
    </article>
  );
}

function StatusMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill={color} />
    </svg>
  );
}

function BaselineWave() {
  return (
    <svg viewBox="0 0 120 36" className="mt-2 h-10 w-full" aria-hidden="true">
      <path d="M0 20 H20 L28 8 L38 30 L48 14 L58 20 H120" fill="none" stroke="#3CF0FF" strokeWidth="2.4" strokeDasharray="8 4" style={{ animation: "ppi-wave 2.8s linear infinite", filter: "drop-shadow(0 0 8px #3CF0FF)" }} />
    </svg>
  );
}

function minutes(startedAt: Date) {
  const span = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60_000));
  return `${span}m`;
}

function advice(signal: CopilotSignal) {
  if (signal.kind === "quality") return t("process.action.quality");
  if (signal.kind === "tooling") return t("process.action.tool");
  if (signal.code === "time") return t("process.action.time");
  if (signal.code === "materialSuggestion") return t("process.action.material");
  if (signal.code === "downtime") return t("process.action.machine");
  return t("process.action.generic");
}
