import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderPhase, RoleName } from "@prisma/client";
import { loadDepartmentGauges } from "@/lib/live-gauge";
import { OwnerHome } from "@/app/dashboard/owner-home";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { hasRole, requireMember } from "@/lib/access";
import { capability } from "@/lib/capability";
import { ownerOrder, type CopilotSignal } from "@/lib/copilot";
import { companySignals } from "@/lib/copilot-query";
import { daysRemaining, deliveryBand, deliveryProbability, type DeliveryQuality, type RiskLevel } from "@/lib/delivery-probability";
import { economicsForProduction } from "@/lib/economics-query";
import { interpretQuality, qualityPercentFromCpk } from "@/lib/quality-evaluation";
import { resolveQualityThresholds } from "@/lib/quality-thresholds";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";

function SignalList({ signals }: { signals: CopilotSignal[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl">{t("copilot.title")}</h2>
      {signals.length === 0 ? <p className="mt-4">{t("copilot.empty")}</p> : null}
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {signals.map((signal) => (
          <li key={`${signal.orderId}-${signal.code}-${signal.subject}`}>
            <Link href={`/dashboard/orders/${signal.orderId}`}>
              {t(`copilot.severity.${signal.severity}`)} · {t(`copilot.${signal.code}`)} · {signal.subject} · {signal.value}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function companyDelivery(
  rows: {
    id: string;
    targetQuantity: number;
    plannedDeliveryAt: Date | null;
    actual: { goodQuantity: number } | null;
    estimate: { useCompanyQualityDefaults: boolean; qualityTargetPercent: { toString(): string } | null; warningDeltaPercent: { toString(): string } | null; criticalDeltaPercent: { toString(): string } | null } | null;
    controlPlan: { controls: { lowerLimit: { toString(): string }; upperLimit: { toString(): string }; measurements: { value: { toString(): string } }[] }[] } | null;
  }[],
  production: { id: string; economics: { time: { estimated: number | null; actual: number } } }[],
  signals: CopilotSignal[],
  timeUnit: "MINUTE" | "HOUR",
  company: { target: number; warningDelta: number; criticalDelta: number },
  now = new Date(),
) {
  let selected: { percent: number; days: number; eta: Date } | null = null;
  for (const order of rows) {
    if (!order.plannedDeliveryAt) continue;
    const economy = production.find((item) => item.id === order.id);
    const estimated = economy?.economics.time.estimated ?? null;
    const actualTime = economy?.economics.time.actual ?? 0;
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
    const scored = deliveryProbability({
      progress: order.targetQuantity > 0 ? (order.actual?.goodQuantity ?? 0) / order.targetQuantity : 0,
      efficiencyRatio: estimated !== null && estimated > 0 ? actualTime / estimated : null,
      qualityState,
      materialRisk,
      toolRisk,
      daysRemaining: daysRemaining(now, order.plannedDeliveryAt),
      estimatedRemainingTime: estimated === null ? 0 : Math.max(0, estimated - actualTime),
      timeUnit,
    });
    if (!selected || scored.percent < selected.percent) {
      selected = { percent: scored.percent, days: daysRemaining(now, order.plannedDeliveryAt), eta: order.plannedDeliveryAt };
    }
  }
  if (!selected) return null;
  return { percent: selected.percent, band: deliveryBand(selected.percent), days: selected.days, eta: selected.eta };
}

function efficiencyView(orders: { economics: { time: { estimated: number | null; actual: number } } }[]) {
  const estimated = orders.reduce((sum, order) => sum + (order.economics.time.estimated ?? 0), 0);
  const actual = orders.reduce((sum, order) => sum + order.economics.time.actual, 0);
  if (estimated <= 0) return { percent: null, ratio: null, actual: null, estimated: null };
  const ratio = actual / estimated;
  return { percent: Math.round(ratio * 100), ratio, actual, estimated };
}

export function efficiencySeries(intervals: { startedAt: Date; endedAt: Date | null }[], estimated: number, unit: "MINUTE" | "HOUR", now = new Date()) {
  if (estimated <= 0 || intervals.length < 2) return [];
  const steps = intervals
    .map((row) => {
      const end = row.endedAt ?? now;
      const minutes = (end.getTime() - row.startedAt.getTime()) / 60_000;
      return { at: end, amount: unit === "HOUR" ? minutes / 60 : minutes };
    })
    .filter((row) => row.amount > 0)
    .sort((left, right) => left.at.getTime() - right.at.getTime());
  let actual = 0;
  const series = steps.map((row) => {
    actual += row.amount;
    return Math.round((actual / estimated) * 100);
  });
  return series.length >= 2 ? series.slice(-16) : [];
}

export function qualityIndexSeries(values: number[], lower: number, upper: number) {
  const series: number[] = [];
  for (let count = 5; count <= values.length; count += 1) {
    const index = capability(values.slice(0, count), lower, upper);
    if (index?.status === "indices") series.push(qualityPercentFromCpk(index.cpk));
  }
  return series.length >= 2 ? series.slice(-16) : [];
}

export function remainingSeries(plan: number, events: { quantity: { toString(): string }; occurredAt: Date }[]) {
  if (plan <= 0 || events.length === 0) return [];
  let remaining = plan;
  const series = [remaining];
  for (const event of [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    remaining = Math.max(0, remaining - Number(event.quantity));
    series.push(remaining);
  }
  return series.length >= 2 ? series.slice(-16) : [];
}

export function toolRiskSeries(plan: number, events: { quantity: { toString(): string }; occurredAt: Date }[]) {
  if (plan <= 0 || events.length === 0) return [];
  let replaced = 0;
  const series: number[] = [];
  for (const event of [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    replaced += Number(event.quantity);
    series.push(Math.min(100, (replaced / plan) * 100));
  }
  return series.length >= 2 ? series.slice(-16) : [];
}

export function scrapRiskSeries(produced: number, events: { pieceCount: number; occurredAt: Date }[]) {
  if (produced <= 0 || events.length === 0) return [];
  let scrap = 0;
  const series: number[] = [];
  for (const event of [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    scrap += event.pieceCount;
    series.push((scrap / produced) * 100);
  }
  return series.length >= 2 ? series.slice(-16) : [];
}

function byDay(dates: Date[]) {
  const buckets = new Map<string, number>();
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-8).map(([, count]) => count);
}

function money(value: number | null) {
  if (value === null) return t("economy.absent");
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export default async function DashboardPage() {
  const { session, user, activeRoles } = await requireMember();
  const owner = hasRole(activeRoles, RoleName.OWNER);
  const planner = owner || hasRole(activeRoles, RoleName.PRODUCTION_MANAGER);
  const quality = hasRole(activeRoles, RoleName.QUALITY_MANAGER);
  const operator = hasRole(activeRoles, RoleName.OPERATOR);
  if (!planner && quality && !operator) redirect("/dashboard/quality");
  if (!planner && !quality && operator) redirect("/dashboard/operator");
  const production = owner ? await economicsForProduction(session.companyId, user.company.timeUnit) : [];
  const signals = owner || planner ? await companySignals(session.companyId, user.company.timeUnit) : [];
  const visible = owner
    ? signals.slice().sort((a, b) => ownerOrder(a) - ownerOrder(b) || a.subject.localeCompare(b.subject))
    : signals.filter((signal) => signal.kind === "production" || signal.kind === "tooling" || signal.kind === "recommendation");
  if (owner) {
    const picture = await withTenant(session.companyId, async (tx) => {
      const rows = await tx.productionOrder.findMany({
        where: { companyId: session.companyId, hiddenAt: null, phase: OrderPhase.IN_PRODUCTION },
        include: {
          part: true,
          actual: true,
          scraps: true,
          estimate: { select: { useCompanyQualityDefaults: true, qualityTargetPercent: true, warningDeltaPercent: true, criticalDeltaPercent: true } },
          controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" } } } } } },
        },
      });
      const certifications = await tx.certification.findMany({
        where: { companyId: session.companyId },
        include: { productionOrder: { include: { part: true } } },
        orderBy: { addedAt: "desc" },
      });
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const [waiting, completedToday, openMachines, operators, scrapEvents, toolUse, toolChanges, toolPlan, materialUse, materialPlan, materialUses] = await Promise.all([
        tx.productionOrder.count({ where: { companyId: session.companyId, hiddenAt: null, phase: OrderPhase.DRAFT } }),
        tx.productionOrder.count({ where: { companyId: session.companyId, hiddenAt: null, phase: OrderPhase.COMPLETED, completedAt: { gte: dayStart } } }),
        tx.machineTime.findMany({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, select: { machineId: true, startedAt: true, endedAt: true } }),
        tx.user.count({ where: { companyId: session.companyId, activeProductionOrderId: { not: null } } }),
        tx.scrap.findMany({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, select: { pieceCount: true, occurredAt: true } }),
        tx.toolChange.aggregate({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, _sum: { quantity: true } }),
        tx.toolChange.findMany({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, select: { quantity: true, occurredAt: true } }),
        tx.estimateToolUse.aggregate({ where: { companyId: session.companyId, estimate: { productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } } }, _sum: { quantity: true } }),
        tx.materialConsumption.aggregate({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, _sum: { quantity: true } }),
        tx.estimateMaterialUse.aggregate({ where: { companyId: session.companyId, estimate: { productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } } }, _sum: { quantity: true } }),
        tx.materialConsumption.findMany({ where: { companyId: session.companyId, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } }, select: { quantity: true, occurredAt: true, material: { select: { unit: true } } } }),
      ]);
      const materialUnits = new Set(materialUses.map((row) => row.material.unit).filter((unit) => unit.trim().length > 0));
      return { rows, certifications, waiting, completedToday, openMachines, operators, scrapEvents, toolUse: toolUse._sum.quantity, toolChanges, toolPlan: toolPlan._sum.quantity, materialUse: materialUse._sum.quantity, materialPlan: materialPlan._sum.quantity, materialUses, materialUnit: materialUnits.size === 1 ? [...materialUnits][0] : "" };
    });
    const economicsById = new Map(production.map((order) => [order.id, order.economics]));
    let scrapPieces = 0;
    let goodPieces = 0;
    const qualityCards: { partName: string; cp: string; cpk: string; confidence: string; confidenceKey: "low" | "medium" | "good" | "high"; points: number[]; lowerLimit: number; upperLimit: number; lower: boolean; qualityTarget: number | null; qualityWarning: number | null; qualityDelta: number | null }[] = [];
    const orders = picture.rows.map((order) => {
      const good = order.actual?.goodQuantity ?? 0;
      const scrap = order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
      goodPieces += good;
      scrapPieces += scrap;
      const controls = order.controlPlan?.controls ?? [];
      const outside = controls.some((control) => {
        const latest = control.measurements.at(-1);
        return latest ? Number(latest.value) < Number(control.lowerLimit) || Number(latest.value) > Number(control.upperLimit) : false;
      });
      for (const control of controls) {
        const values = control.measurements.map((measurement) => Number(measurement.value));
        const index = capability(values, Number(control.lowerLimit), Number(control.upperLimit));
        if (index?.status === "indices") {
          const resolved = resolveQualityThresholds({
            useCompanyDefaults: order.estimate?.useCompanyQualityDefaults !== false,
            target: order.estimate?.qualityTargetPercent == null ? null : Number(order.estimate.qualityTargetPercent),
            warningDelta: order.estimate?.warningDeltaPercent == null ? null : Number(order.estimate.warningDeltaPercent),
            criticalDelta: order.estimate?.criticalDeltaPercent == null ? null : Number(order.estimate.criticalDeltaPercent),
            companyTarget: Number(user.company.defaultQualityTargetPercent),
            companyWarningDelta: Number(user.company.defaultWarningDeltaPercent),
            companyCriticalDelta: Number(user.company.defaultCriticalDeltaPercent),
          });
          qualityCards.push({
            partName: order.part.name,
            cp: index.cp.toFixed(2),
            cpk: index.cpk.toFixed(2),
            confidence: t(`quality.confidence.${index.confidence}`),
            confidenceKey: index.confidence,
            points: qualityIndexSeries(values, Number(control.lowerLimit), Number(control.upperLimit)),
            lowerLimit: Number(control.lowerLimit),
            upperLimit: Number(control.upperLimit),
            lower: signals.some((signal) => signal.orderId === order.id && signal.code === "cpk"),
            qualityTarget: resolved?.target ?? null,
            qualityWarning: resolved?.warningDelta ?? null,
            qualityDelta: resolved?.criticalDelta ?? null,
          });
        }
      }
      const economy = economicsById.get(order.id);
      const deviation = economy?.marginDeviation;
      return {
        id: order.id,
        partName: order.part.name,
        phaseLabel: t(`order.phase.${order.phase}`),
        quality: controls.length === 0 ? "none" as const : outside ? "alert" as const : "ok" as const,
        scrap: order.actual ? scrap : null,
        expectedCost: money(economy?.estimatedCost ?? null),
        actualCost: money(economy?.actualCost ?? null),
        costDeviation: money(economy?.costDeviation ?? null),
        expectedMargin: money(economy?.expectedMargin ?? null),
        actualMargin: money(economy?.actualMargin ?? null),
        marginDeviation: money(deviation ?? null),
        deviationTone: deviation == null || deviation === 0 ? "flat" as const : deviation < 0 ? "down" as const : "up" as const,
        costTone: economy?.costDeviation === undefined || economy.costDeviation === 0 ? "flat" as const : economy.costDeviation > 0 ? "up" as const : "down" as const,
      };
    });
    const qualityCard = qualityCards.reduce<(typeof qualityCards)[number] | null>((lowest, card) => lowest === null || Number(card.cpk) < Number(lowest.cpk) ? card : lowest, null);
    const department = await loadDepartmentGauges(session.companyId);
    return (
      <OwnerHome
        department={department}
        companyName={user.company.name}
        person={{ name: personName(user), role: positionLabel(activeRoles) }}
        today={todayLabel()}
        signals={visible}
        certifications={picture.certifications.length}
        qualityPoints={qualityCard?.points ?? []}
        mosaic={{
          orders: orders.length,
          criticalOrders: orders.filter((order) => visible.some((signal) => signal.orderId === order.id && signal.severity === "critical")).length,
          criticalSignals: visible.filter((signal) => signal.severity === "critical").length,
          quality: qualityCard?.cpk ?? null,
          qualityTarget: qualityCard?.qualityTarget ?? null,
          qualityWarning: qualityCard?.qualityWarning ?? null,
          qualityDelta: qualityCard?.qualityDelta ?? null,
          scrap: goodPieces + scrapPieces > 0 ? `${Math.round((scrapPieces / (goodPieces + scrapPieces)) * 100)}%` : null,
          scrapRiskSeries: scrapRiskSeries(goodPieces + scrapPieces, picture.scrapEvents),
          scrapProduced: goodPieces + scrapPieces > 0 ? goodPieces + scrapPieces : null,
          scrapPieces: goodPieces + scrapPieces > 0 ? scrapPieces : null,
          machines: new Set(picture.openMachines.filter((row) => row.endedAt === null).map((row) => row.machineId)).size,
          efficiency: efficiencyView(production),
          efficiencySeries: efficiencySeries(picture.openMachines, efficiencyView(production).estimated ?? 0, user.company.timeUnit),
          toolTrend: toolRiskSeries(Number(picture.toolPlan ?? 0), picture.toolChanges),
          materialTrend: remainingSeries(Number(picture.materialPlan ?? 0), picture.materialUses),
          deliveryTrend: [],
          timeUnit: user.company.timeUnit,
          tools: visible.filter((signal) => signal.kind === "tooling").length,
          toolActive: Math.max(0, Number(picture.toolPlan ?? 0) - Number(picture.toolUse ?? 0)),
          toolReplaced: Number(picture.toolUse ?? 0),
          toolRisk: Number(picture.toolPlan ?? 0) <= 0 ? (Number(picture.toolUse ?? 0) > 0 ? 100 : 0) : Math.min(100, (Number(picture.toolUse ?? 0) / Number(picture.toolPlan)) * 100),
          toolQuantity: picture.toolUse === null ? null : Number(picture.toolUse),
          materialQuantity: picture.materialUse === null ? null : Number(picture.materialUse),
          materialRemaining: Math.max(0, Number(picture.materialPlan ?? 0) - Number(picture.materialUse ?? 0)),
          materialUsed: Number(picture.materialUse ?? 0),
          materialUnit: picture.materialUnit,
          materialCoverage: Number(picture.materialPlan ?? 0) <= 0 ? null : (Math.max(0, Number(picture.materialPlan) - Number(picture.materialUse ?? 0)) / Number(picture.materialPlan)) * 100,
          delivery: companyDelivery(picture.rows, production, visible, user.company.timeUnit, {
            target: Number(user.company.defaultQualityTargetPercent),
            warningDelta: Number(user.company.defaultWarningDeltaPercent),
            criticalDelta: Number(user.company.defaultCriticalDeltaPercent),
          }),
          waiting: picture.waiting,
          completedToday: picture.completedToday,
          operators: picture.operators,
          productionTrend: byDay(picture.openMachines.map((row) => row.startedAt)),
          scrapTrend: byDay(picture.scrapEvents.flatMap((row) => Array.from({ length: row.pieceCount }, () => row.occurredAt))),
        }}
      />
    );
  }
  return (
    <main>
      <h1 className="text-3xl">{t("dashboard.title")}</h1>
      <p className="mt-2 text-stone-600">{user.company.name}</p>
      {owner ? (
        <section className="mt-8">
          <h2 className="text-xl">{t("dashboard.production")}</h2>
          {production.length === 0 ? <p className="mt-4">{t("dashboard.none")}</p> : null}
          {production.length > 0 ? (
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left">
                  <th className="py-2">{t("order.part")}</th>
                  <th>{t("economy.expectedCost")}</th>
                  <th>{t("economy.actualCost")}</th>
                  <th>{t("economy.costDeviation")}</th>
                  <th>{t("economy.expectedMargin")}</th>
                  <th>{t("economy.actualMargin")}</th>
                  <th>{t("economy.marginDeviation")}</th>
                </tr>
              </thead>
              <tbody>
                {production.map((order) => (
                  <tr key={order.id} className="border-b border-stone-200">
                    <td className="py-2"><Link href={`/dashboard/orders/${order.id}`}>{order.partName}</Link></td>
                    <td>{money(order.economics.estimatedCost)}</td>
                    <td>{money(order.economics.actualCost)}</td>
                    <td>{money(order.economics.costDeviation)}</td>
                    <td>{money(order.economics.expectedMargin)}</td>
                    <td>{money(order.economics.actualMargin)}</td>
                    <td>{money(order.economics.marginDeviation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
      {owner || (planner && !owner) ? <SignalList signals={visible} /> : <p className="mt-6 max-w-xl">{t("dashboard.empty")}</p>}
    </main>
  );
}
