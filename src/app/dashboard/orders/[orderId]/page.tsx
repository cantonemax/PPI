import { notFound, redirect } from "next/navigation";
import { OrderPhase, RoleName, TimeUnit } from "@prisma/client";
import { CertificationSection } from "@/app/dashboard/orders/certification-section";
import { QualityRulesForm } from "@/app/dashboard/orders/quality-rules-form";
import { ComparisonSection } from "@/app/dashboard/orders/comparison";
import { OrdersShell, type OrdersView } from "@/app/dashboard/orders/orders-shell";
import { ScheduleWatch } from "@/app/dashboard/orders/schedule-watch";
import { canSeeEconomics, hasRole, requireMember } from "@/lib/access";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { comparisonPaused, deliveryPaused } from "@/lib/service-phase";
import { economicsForOrder } from "@/lib/economics-query";
import { companySignals } from "@/lib/copilot-query";
import { capability } from "@/lib/capability";
import { t } from "@/lib/i18n";
import { daysRemaining, deliveryProbability, type DeliveryQuality, type RiskLevel } from "@/lib/delivery-probability";
import { interpretQuality, qualityPercentFromCpk } from "@/lib/quality-evaluation";
import { resolveQualityThresholds } from "@/lib/quality-thresholds";
import { withTenant } from "@/lib/prisma";
import { romeDateTimeLabel, romeDateTimeLocal } from "@/lib/rome-time";
import { assignOrderDesk, cancelDraft, cancelStart, clearScheduledStart, completeOrder, duplicateOrder, reopenOrder, scheduleOrderStart, startOrder } from "@/server/order-actions";

async function ComparisonBlock({
  companyId,
  timeUnit,
  orderId,
  economic,
}: {
  companyId: string;
  timeUnit: TimeUnit;
  orderId: string;
  economic: boolean;
}) {
  const loaded = await economicsForOrder(companyId, timeUnit, orderId);
  if (!loaded) return null;
  return <ComparisonSection economics={loaded.economics} economic={economic} />;
}

function companyThresholds(company: { defaultQualityTargetPercent: { toString(): string }; defaultWarningDeltaPercent: { toString(): string }; defaultCriticalDeltaPercent: { toString(): string } }) {
  return {
    target: Number(company.defaultQualityTargetPercent),
    warningDelta: Number(company.defaultWarningDeltaPercent),
    criticalDelta: Number(company.defaultCriticalDeltaPercent),
  };
}

function dateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function listView(phase: OrderPhase): OrdersView | undefined {
  if (phase === OrderPhase.DRAFT) return "draft";
  if (phase === OrderPhase.IN_PRODUCTION) return "active";
  if (phase === OrderPhase.COMPLETED) return "closed";
  return undefined;
}

const card = "rounded-2xl border border-white/10 bg-[#0b1830]/75 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]";
const heading = "text-[15px] uppercase tracking-[0.16em] text-cyan-200";
const copy = "mt-3 flex flex-col gap-1 text-[13px] uppercase tracking-[0.06em] text-slate-300";
const action = "inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-[13px] uppercase tracking-[0.08em] text-white";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orderId } = await params;
  const { error } = await searchParams;
  const { session, user, activeRoles } = await requireMember();
  const economic = canSeeEconomics(activeRoles);
  const planner = hasRole(activeRoles, RoleName.OWNER) || hasRole(activeRoles, RoleName.PRODUCTION_MANAGER);
  const quality = hasRole(activeRoles, RoleName.OWNER) || hasRole(activeRoles, RoleName.QUALITY_MANAGER);
  if (!planner && !quality) redirect("/dashboard");
  const order = await withTenant(session.companyId, (tx) => tx.productionOrder.findFirst({
    where: { id: orderId, companyId: session.companyId, hiddenAt: null },
    include: {
      part: true,
      assignedOperator: { select: { email: true } },
      estimate: { include: { machine: true, toolUses: { include: { tool: true } }, materialUses: { include: { material: true } } } },
      actual: true,
      controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" } } } } } },
      drawings: { orderBy: { addedAt: "desc" } },
      technicalDocuments: { orderBy: { addedAt: "desc" } },
      productionNotes: { orderBy: { addedAt: "desc" } },
      certifications: quality ? { orderBy: { addedAt: "desc" } } : false,
    },
  }));
  if (!order?.estimate) notFound();
  const stations = planner ? await withTenant(session.companyId, (tx) => Promise.all([
    tx.machine.findMany({ where: { companyId: session.companyId, hiddenAt: null, retiredAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    tx.user.findMany({
      where: { companyId: session.companyId, revokedAt: null, roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } } },
      orderBy: { email: "asc" },
      select: { id: true, email: true },
    }),
  ])) : [[], []];
  const [machines, operators] = stations;
  const certified = order.phase === OrderPhase.COMPLETED && Array.isArray(order.certifications) && order.certifications.length > 0;
  const shell = {
    title: order.code?.trim() || order.part.name,
    today: todayLabel(),
    person: { name: personName(user), role: positionLabel(activeRoles) },
    view: listView(order.phase),
    showCommands: planner,
  };
  if (!planner) {
    return (
      <OrdersShell {...shell}>
        <div className="flex max-w-5xl flex-col gap-4">
          <section className={card}>
            <h2 className={heading}>{order.part.name}</h2>
            <p className={copy}>{t(`order.phase.${order.phase}`)}</p>
          </section>
          {certified && Array.isArray(order.certifications) ? <CertificationSection orderId={order.id} phase={order.phase} rows={order.certifications} /> : null}
        </div>
      </OrdersShell>
    );
  }
  const draft = order.phase === OrderPhase.DRAFT;
  const open = draft || order.phase === OrderPhase.IN_PRODUCTION;
  const rules = resolveQualityThresholds({
    useCompanyDefaults: order.estimate.useCompanyQualityDefaults,
    target: order.estimate.qualityTargetPercent == null ? null : Number(order.estimate.qualityTargetPercent),
    warningDelta: order.estimate.warningDeltaPercent == null ? null : Number(order.estimate.warningDeltaPercent),
    criticalDelta: order.estimate.criticalDeltaPercent == null ? null : Number(order.estimate.criticalDeltaPercent),
    companyTarget: companyThresholds(user.company).target,
    companyWarningDelta: companyThresholds(user.company).warningDelta,
    companyCriticalDelta: companyThresholds(user.company).criticalDelta,
  });
  return (
    <OrdersShell {...shell}>
      <div className="flex max-w-5xl flex-col gap-4">
      {error ? <p className="text-[13px] uppercase tracking-[0.08em] text-[#FF4D4F]">{t(error)}</p> : null}
      <section className={card}>
        <h2 className={heading}>{t("order.identity")}</h2>
        <div className={copy}>
        <p>{order.code || order.part.name}</p>
        <p>{order.part.name}</p>
        <p>{t("order.quantity")}: {order.targetQuantity}</p>
        <p>{t("order.plannedStart")}: {dateInput(order.plannedStartAt) || "—"}</p>
        <p>{t("order.plannedDelivery")}: {dateInput(order.plannedDeliveryAt) || "—"}</p>
        <p>{t("order.actualStart")}: {dateInput(order.startedAt) || "—"}</p>
        <p>{t("order.actualEnd")}: {dateInput(order.completedAt) || "—"}</p>
        <p>{t(`order.phase.${order.phase}`)}</p>
        </div>
      </section>
      {open ? <section className={card}>
        <h2 className={heading}>{t("order.desk")}</h2>
        {draft ? (
          <form action={assignOrderDesk} className="mt-3 grid max-w-xl gap-3 text-[13px] uppercase tracking-[0.08em]">
            <input type="hidden" name="orderId" value={order.id} />
            <label>{t("order.machine")}
              <select name="machineId" defaultValue={order.estimate.machineId ?? ""} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-slate-100 outline-none [color-scheme:dark]">
                <option value="">{t("order.none")}</option>
                {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
              </select>
            </label>
            <label>{t("order.operator")}
              <select name="operatorId" defaultValue={order.assignedOperatorId ?? ""} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-slate-100 outline-none [color-scheme:dark]">
                <option value="">{t("order.none")}</option>
                {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.email}</option>)}
              </select>
            </label>
            <button className={`${action} w-fit`}>{t("order.assign")}</button>
          </form>
        ) : (
          <div className={copy}>
            <p>{t("order.machine")}: {order.estimate.machine?.name ?? t("order.none")}</p>
            <p>{t("order.operator")}: {order.assignedOperator?.email ?? t("order.none")}</p>
          </div>
        )}
      </section> : null}
      {deliveryPaused ? null : <DeliveryBlock companyId={session.companyId} timeUnit={user.company.timeUnit} order={order} company={companyThresholds(user.company)} />}
      {open ? (
        <section className={card}>
          <h2 className={heading}>{t("order.qualityTargets")}</h2>
          <QualityRulesForm
            orderId={order.id}
            useDefaults={order.estimate.useCompanyQualityDefaults}
            target={rules && !order.estimate.useCompanyQualityDefaults ? String(rules.target) : String(companyThresholds(user.company).target)}
            warningDelta={rules && !order.estimate.useCompanyQualityDefaults ? String(rules.warningDelta) : String(companyThresholds(user.company).warningDelta)}
            criticalDelta={rules && !order.estimate.useCompanyQualityDefaults ? String(rules.criticalDelta) : String(companyThresholds(user.company).criticalDelta)}
            companyTarget={String(companyThresholds(user.company).target)}
            companyWarning={String(companyThresholds(user.company).warningDelta)}
            companyCritical={String(companyThresholds(user.company).criticalDelta)}
          />
        </section>
      ) : null}
      {comparisonPaused ? null : <ComparisonBlock companyId={session.companyId} timeUnit={user.company.timeUnit} orderId={order.id} economic={economic} />}
      <section className={card}>
        <h2 className={heading}>{t("order.lifecycle")}</h2>
        {draft && order.scheduledStartAt ? <ScheduleWatch at={order.scheduledStartAt.toISOString()} /> : null}
        {draft && order.scheduledStartAt ? <p className={copy}>{t("order.scheduledFor")}: {romeDateTimeLabel(order.scheduledStartAt)}</p> : null}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {draft ? (
            <>
              <form action={startOrder}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.start")}</button></form>
              <form action={scheduleOrderStart} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="text-[13px] uppercase tracking-[0.08em] text-slate-300">{t("order.scheduleAt")}
                  <input type="datetime-local" name="scheduledStartAt" required defaultValue={order.scheduledStartAt ? romeDateTimeLocal(order.scheduledStartAt) : ""} className="mt-1 block rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-slate-100 outline-none [color-scheme:dark]" />
                </label>
                <button className={action}>{t("order.scheduleStart")}</button>
              </form>
              {order.scheduledStartAt ? <form action={clearScheduledStart}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.scheduleClear")}</button></form> : null}
              <form action={cancelDraft}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.cancel")}</button></form>
            </>
          ) : null}
          {order.phase === OrderPhase.IN_PRODUCTION ? (
            <>
              <form action={completeOrder}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.complete")}</button></form>
              <form action={cancelStart}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.cancelStart")}</button></form>
              <form action={duplicateOrder}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.duplicate")}</button></form>
            </>
          ) : null}
          {order.phase === OrderPhase.COMPLETED ? (
            <>
              <form action={reopenOrder}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.reopen")}</button></form>
              <form action={duplicateOrder}><input type="hidden" name="orderId" value={order.id} /><button className={action}>{t("order.duplicate")}</button></form>
            </>
          ) : null}
        </div>
      </section>
      {certified && Array.isArray(order.certifications) ? <CertificationSection orderId={order.id} phase={order.phase} rows={order.certifications} /> : null}
      </div>
    </OrdersShell>
  );
}

async function DeliveryBlock({
  companyId,
  timeUnit,
  order,
  company,
}: {
  companyId: string;
  timeUnit: TimeUnit;
  company: { target: number; warningDelta: number; criticalDelta: number };
  order: {
    id: string;
    targetQuantity: number;
    plannedDeliveryAt: Date | null;
    actual: { goodQuantity: number } | null;
    estimate: { useCompanyQualityDefaults: boolean; qualityTargetPercent: { toString(): string } | null; warningDeltaPercent: { toString(): string } | null; criticalDeltaPercent: { toString(): string } | null } | null;
    controlPlan: { controls: { lowerLimit: { toString(): string }; upperLimit: { toString(): string }; measurements: { value: { toString(): string } }[] }[] } | null;
  };
}) {
  const loaded = await economicsForOrder(companyId, timeUnit, order.id);
  const signals = await companySignals(companyId, timeUnit);
  let cpk: number | null = null;
  for (const control of order.controlPlan?.controls ?? []) {
    const values = control.measurements.map((measurement) => Number(measurement.value));
    const index = capability(values, Number(control.lowerLimit), Number(control.upperLimit));
    if (index?.status === "indices" && (cpk === null || index.cpk < cpk)) cpk = index.cpk;
  }
  const thresholds = resolveQualityThresholds({
    useCompanyDefaults: order.estimate?.useCompanyQualityDefaults !== false,
    target: order.estimate?.qualityTargetPercent == null ? null : Number(order.estimate.qualityTargetPercent),
    warningDelta: order.estimate?.warningDeltaPercent == null ? null : Number(order.estimate.warningDeltaPercent),
    criticalDelta: order.estimate?.criticalDeltaPercent == null ? null : Number(order.estimate.criticalDeltaPercent),
    companyTarget: company.target,
    companyWarningDelta: company.warningDelta,
    companyCriticalDelta: company.criticalDelta,
  });
  const qualityState: DeliveryQuality = cpk !== null && thresholds ? interpretQuality(qualityPercentFromCpk(cpk), thresholds.target, thresholds.warningDelta, thresholds.criticalDelta) : null;
  const materialRisk: RiskLevel = signals.some((signal) => signal.orderId === order.id && signal.code === "materialSuggestion" && signal.severity === "critical")
    ? "critical"
    : signals.some((signal) => signal.orderId === order.id && signal.code === "materialSuggestion") ? "moderate" : "none";
  const toolRisk: RiskLevel = signals.some((signal) => signal.orderId === order.id && signal.kind === "tooling" && signal.severity === "critical")
    ? "critical"
    : signals.some((signal) => signal.orderId === order.id && signal.kind === "tooling") ? "moderate" : "none";
  const estimated = loaded?.economics.time.estimated ?? null;
  const actualTime = loaded?.economics.time.actual ?? 0;
  const result = order.plannedDeliveryAt
    ? deliveryProbability({
      progress: order.targetQuantity > 0 ? (order.actual?.goodQuantity ?? 0) / order.targetQuantity : 0,
      efficiencyRatio: estimated !== null && estimated > 0 ? actualTime / estimated : null,
      qualityState,
      materialRisk,
      toolRisk,
      daysRemaining: daysRemaining(new Date(), order.plannedDeliveryAt),
      estimatedRemainingTime: estimated === null ? 0 : Math.max(0, estimated - actualTime),
      timeUnit,
    })
    : null;
  const band = result?.band === "high" ? "high" : result?.band === "moderate" ? "moderate" : "low";
  return (
    <section className={card}>
      <h2 className={heading}>{t("dashboard.slot.delivery")}</h2>
      <ul className={copy}>
        <li>{result ? `${result.percent}%` : t("dashboard.noData")}</li>
        <li>{result ? t(`dashboard.kpiLabel.delivery.${band}`) : t("dashboard.monitor.unavailable")}</li>
      </ul>
    </section>
  );
}

