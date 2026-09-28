import { OrderPhase, type Prisma, RoleName, TimeUnit } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { efficiencySeries, qualityIndexSeries, remainingSeries, scrapRiskSeries, toolRiskSeries } from "@/app/dashboard/page";
import { MachineGauge, SelectedOrder } from "@/app/dashboard/gauge-visual";
import { OwnerFrame, Tile, coverageRing, deliveryNote, efficiencyNote, efficiencyPrimary, efficiencyRing, efficiencyStatus, efficiencyTone, gaugeOf, materialNote, materialStatus, materialTone, qualityNote, qualityOperationalStatus, qualityOperationalTone, qualityRing, qualityScore, riskRing, scrapNote, scrapStatus, scrapTone, toolNote, toolStatus, toolTone } from "@/app/dashboard/owner-home";
import { hasRole, requireMember } from "@/lib/access";
import { personName, positionLabel } from "@/lib/session-identity";
import { capability } from "@/lib/capability";
import { type CopilotSignal } from "@/lib/copilot";
import { companySignals } from "@/lib/copilot-query";
import { daysRemaining, deliveryProbability, type DeliveryQuality, type RiskLevel } from "@/lib/delivery-probability";
import { orderEconomics } from "@/lib/economics";
import { interpretQuality, qualityPercentFromCpk } from "@/lib/quality-evaluation";
import { resolveQualityThresholds } from "@/lib/quality-thresholds";
import { t } from "@/lib/i18n";
import { liveProcessGauge } from "@/lib/live-gauge";
import { withTenant } from "@/lib/prisma";
import { setActiveOrder } from "@/server/floor-actions";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const contextCard = "relative flex h-[280px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#050d18] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_50px_rgba(0,0,0,0.45)]";
const sectionTitle = "text-[12px] uppercase tracking-[0.16em] text-slate-400";

export default async function MachineWorkspacePage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const { session, user, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) redirect("/dashboard");
  const signals = await companySignals(session.companyId, user.company.timeUnit);
  const picture = await withTenant(session.companyId, async (tx) => {
    const machine = await tx.machine.findFirst({ where: { id: machineId, companyId: session.companyId, hiddenAt: null } });
    if (!machine) return null;
    const running = await tx.machineTime.findFirst({
      where: { companyId: session.companyId, machineId, endedAt: null, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } },
      orderBy: { startedAt: "desc" },
    });
    const stopped = running ? null : await tx.downtime.findFirst({
      where: { companyId: session.companyId, machineId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    const orderId = running?.productionOrderId ?? stopped?.productionOrderId;
    if (!orderId) return { machine, order: null, open: Boolean(running) };
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: session.companyId, hiddenAt: null },
      include: {
        part: { include: { dimensions: { where: { enabled: true }, orderBy: { reference: "asc" } } } },
        estimate: { include: { toolUses: { include: { tool: true } }, materialUses: { include: { material: true } } } },
        actual: true,
        scraps: { orderBy: { occurredAt: "desc" } },
        machineTimes: { where: { machineId }, include: { machine: true } },
        toolChanges: { include: { tool: true }, orderBy: { occurredAt: "desc" } },
        materialConsumptions: { include: { material: true }, orderBy: { occurredAt: "desc" } },
        controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" } } } } } },
      },
    });
    return { machine, order, open: Boolean(running) };
  });
  if (!picture) notFound();
  const order = picture.order;
  const orderSignals = order ? signals.filter((signal) => signal.orderId === order.id) : [];
  const company = {
    target: Number(user.company.defaultQualityTargetPercent),
    warningDelta: Number(user.company.defaultWarningDeltaPercent),
    criticalDelta: Number(user.company.defaultCriticalDeltaPercent),
  };
  const reading = order ? readOrder(order, picture.machine.id, user.company.timeUnit, company, orderSignals) : null;
  const today = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(new Date());
  return (
    <OwnerFrame companyName={user.company.name} today={today} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/copilot">
      <div className="grid content-start gap-3 px-3 py-3">
        <Link href="/dashboard/copilot" className="text-[12px] uppercase tracking-[0.16em] text-cyan-200">{t("nav.copilot")}</Link>
        <MachineGauge
          score={reading ? reading.score : null}
          orders={order ? 1 : 0}
          prediction={reading?.nextAction ?? t("process.normal")}
          stops={picture.open ? 0 : 1}
          scrap={order ? order.scraps.reduce((sum, item) => sum + item.pieceCount, 0) : 0}
        />
        {order ? (
          <SelectedOrder
            code={order.id.slice(-6).toUpperCase()}
            article={order.part.name}
            quantity={String(order.targetQuantity)}
            controls={String(order.controlPlan?.controls.length ?? 0)}
          />
        ) : null}
        <section className="grid grid-cols-3 gap-3">
          <article className={`${contextCard} items-center justify-center text-center`}>
            <div className="flex h-full flex-col items-center justify-center gap-5">
              <p className="absolute inset-x-0 top-2 text-center text-[15px] font-medium uppercase leading-none tracking-[0.22em] text-slate-400">{t("workspace.productionStatus")}</p>
              <p className="text-[18px] font-semibold leading-none" style={{ color: reading?.tone ?? "#8E9AAB" }}>{reading ? reading.score : ""}<span className="text-[13px] text-slate-400">{reading ? " / 100" : t("dashboard.kpi.empty")}</span></p>
              <p className="text-[18px] font-semibold uppercase tracking-[0.14em]" style={{ color: reading?.tone ?? "#8E9AAB" }}>{reading?.orderState ?? t("dashboard.kpi.empty")}</p>
              <div className="flex flex-col gap-[2.5px]">
                <p className="text-[13px] uppercase tracking-[0.14em] text-slate-500">{t("process.nextAction")}</p>
                <p className="text-[16px] text-white">{reading?.nextAction ?? t("process.normal")}</p>
              </div>
            </div>
          </article>
          <article className={`${contextCard} items-center justify-center`}>
            <div className="flex flex-col items-center gap-5 text-center">
              <p className="absolute inset-x-0 top-2 text-center text-[15px] font-medium uppercase leading-none tracking-[0.22em] text-slate-400">{t("workspace.productionPulse")}</p>
              <PresenceRing color={reading?.tone ?? "#8E9AAB"} live={picture.open} />
              <p className="text-[15px] font-semibold uppercase leading-none tracking-[0.08em]" style={{ color: reading?.tone ?? "#8E9AAB" }}>{pulseLabel(picture.open, reading?.orderState ?? null)}</p>
            </div>
          </article>
          {order ? (
            <form action={setActiveOrder} className={contextCard}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="relative flex h-full w-full flex-col items-center justify-center pb-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <p className="absolute inset-x-0 top-2 text-center text-[15px] font-medium uppercase leading-none tracking-[0.22em] text-slate-400">{t("workspace.operations")}</p>
                  <p className="text-[18px] font-semibold leading-none text-white">{picture.machine.name}</p>
                  <p className="text-[13px] tracking-[0.12em] text-slate-200">{order.id.slice(-6).toUpperCase()}</p>
                  <p className="text-[13px] text-slate-300">{order.part.name}</p>
                  <p className="text-[13px] uppercase tracking-[0.08em] text-slate-300">{`${t("process.eta")} ${reading?.completion ?? t("dashboard.kpi.empty")}`}</p>
                </div>
                <p className="absolute bottom-0 right-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-100">{t("workspace.goToOperations")}</p>
              </button>
            </form>
          ) : (
            <article className={`${contextCard} items-center justify-center text-center`}>
              <p className="absolute inset-x-0 top-2 text-center text-[15px] font-medium uppercase leading-none tracking-[0.22em] text-slate-400">{t("workspace.operations")}</p>
              <p className="mt-3 text-[13px] text-slate-400">{t("dashboard.kpi.empty")}</p>
            </article>
          )}
        </section>
        <section className={`${shell} grid h-[320px] grid-cols-6 gap-2 p-3`}>
          {reading ? (
            <>
              <Tile hint={t("dashboard.hint.quality")} label={t("dashboard.slot.quality")} value={qualityScore(reading.cpkText)} status={qualityOperationalStatus(reading.cpkText, reading.target, reading.warning, reading.delta)} tone={qualityOperationalTone(reading.cpkText, reading.target, reading.warning, reading.delta)} points={reading.qualityPoints} note={qualityNote(reading.cpkText, reading.target, reading.warning, reading.delta)} ring={qualityRing(reading.cpkText)} />
              <Tile hint={t("dashboard.hint.scrap")} label={t("dashboard.slot.scrap")} value={reading.scrapValue ?? t("dashboard.noData")} status={scrapStatus(orderSignals)} tone={scrapTone(orderSignals)} points={reading.scrapPoints} gauge={gaugeOf(reading.scrapValue)} note={scrapNote(reading.scrapProduced, reading.scrapPieces)} ring={riskRing(gaugeOf(reading.scrapValue))} />
              <Tile hint={t("dashboard.hint.efficiency")} label={t("dashboard.slot.production")} value={efficiencyPrimary(reading.efficiencyView)} status={efficiencyStatus(reading.efficiencyView.ratio)} tone={efficiencyTone(reading.efficiencyView.ratio)} note={efficiencyNote(reading.efficiencyView, user.company.timeUnit)} points={reading.efficiencyPoints} ring={efficiencyRing(reading.efficiencyView.percent)} />
              <Tile hint={t("dashboard.hint.tools")} label={t("dashboard.slot.tools")} value={String(reading.toolCount)} status={toolStatus(orderSignals, reading.toolCount)} tone={toolTone(orderSignals, reading.toolCount)} points={reading.toolPoints} note={toolNote(reading.toolActive, reading.toolReplaced)} ring={riskRing(reading.toolRisk)} />
              <Tile hint={t("dashboard.hint.materials")} label={t("dashboard.slot.materials")} value={reading.materialCoverage === null ? t("dashboard.noData") : `${Math.round(reading.materialCoverage)}%`} status={materialStatus(orderSignals)} tone={materialTone(orderSignals)} points={reading.materialPoints} relative note={materialNote(reading.materialRemaining, reading.materialUsed, reading.materialUnit)} ring={coverageRing(reading.materialCoverage)} />
              <Tile hint={t("dashboard.hint.delivery")} label={t("dashboard.slot.delivery")} value={reading.deliveryCard === null ? t("dashboard.noData") : `${reading.deliveryCard.percent}%`} status={reading.deliveryCard === null ? t("dashboard.kpi.empty") : t(`dashboard.kpiLabel.delivery.${reading.deliveryCard.band === "high" ? "high" : reading.deliveryCard.band === "moderate" ? "moderate" : "low"}`)} tone={reading.deliveryCard === null ? "monitor" : reading.deliveryCard.band === "high" ? "good" : reading.deliveryCard.band === "moderate" ? "moderate" : "severe"} points={[]} note={deliveryNote(reading.deliveryCard)} ring={reading.deliveryCard === null ? null : riskRing(reading.deliveryCard.percent)} />
            </>
          ) : null}
        </section>
        <section className={`${shell} p-3`}>
          <h2 className={sectionTitle}>{t("workspace.events")}</h2>
          <List empty={reading === null || reading.events.length === 0} rows={reading?.events ?? []} />
        </section>
      </div>
    </OwnerFrame>
  );
}

function pulseLabel(live: boolean, state: string | null) {
  if (!live) return t("process.stopped");
  return state ?? t("process.running");
}

function PresenceRing({ color, live }: { color: string; live: boolean }) {
  return (
    <svg viewBox="0 0 36 36" className="h-[90px] w-[90px] shrink-0" aria-hidden="true" style={live ? { animation: "ppi-work-pulse 3.2s ease-in-out infinite" } : undefined}>
      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="88 88" transform="rotate(-90 18 18)" />
    </svg>
  );
}

function List({ rows, empty }: { rows: { key: string; title: string; detail: string; color: string }[]; empty: boolean }) {
  if (empty) return <p className="mt-4 text-center text-[13px] text-slate-400">{t("process.empty")}</p>;
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: row.color }}>{row.title}</span>
          <span className="block text-[13px] text-slate-300">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}

type LoadedOrder = Prisma.ProductionOrderGetPayload<{
  include: {
    part: { include: { dimensions: { where: { enabled: true }, orderBy: { reference: "asc" } } } };
    estimate: { include: { toolUses: { include: { tool: true } }; materialUses: { include: { material: true } } } };
    actual: true;
    scraps: true;
    machineTimes: { include: { machine: true } };
    toolChanges: { include: { tool: true } };
    materialConsumptions: { include: { material: true } };
    controlPlan: { include: { controls: { include: { measurements: true } } } };
  };
}>;

function readOrder(order: LoadedOrder, machineId: string, timeUnit: TimeUnit, company: { target: number; warningDelta: number; criticalDelta: number }, signals: CopilotSignal[]) {
  const now = new Date();
  const good = order.actual?.goodQuantity ?? 0;
  const scrap = order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
  const produced = good + scrap;
  const progress = produced > 0 ? `${Math.round((good / produced) * 100)}%` : t("dashboard.kpi.empty");
  const machineTimes = order.machineTimes.filter((interval) => interval.machineId === machineId);
  const openInterval = machineTimes.find((interval) => interval.endedAt === null);
  const runtime = openInterval ? Math.max(0, Math.round((now.getTime() - openInterval.startedAt.getTime()) / 60000)) : 0;
  const gauge = liveProcessGauge(order, runtime);
  const tone = gauge?.state === "STABLE" ? "#00E676" : gauge?.state === "ATTENTION" ? "#FF9800" : gauge ? "#FF4D4F" : "#8E9AAB";
  const orderState = gauge?.state === "STABLE" ? t("dashboard.processWord.stable") : gauge?.state === "ATTENTION" ? t("dashboard.processWord.attention") : gauge ? t("dashboard.processWord.critical") : t("dashboard.kpi.empty");
  const completion = order.plannedDeliveryAt
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" }).format(order.plannedDeliveryAt)
    : t("dashboard.kpi.empty");
  const economics = order.estimate ? orderEconomics({
    timeUnit,
    targetQuantity: order.targetQuantity,
    timePerPiece: amount(order.estimate.timePerPiece),
    expectedScrap: amount(order.estimate.expectedScrap),
    hourlyRateSnapshot: amount(order.estimate.hourlyRateSnapshot),
    otherOperationalCost: amount(order.estimate.otherOperationalCost),
    agreedOperationalValue: amount(order.estimate.agreedOperationalValue),
    estimatedTools: order.estimate.toolUses.map((use) => ({ id: use.toolId, name: use.tool.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    estimatedMaterials: order.estimate.materialUses.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    machineTimes: machineTimes.map((interval) => ({ hourlyRateSnapshot: Number(interval.hourlyRateSnapshot), startedAt: interval.startedAt, endedAt: interval.endedAt })),
    toolChanges: order.toolChanges.map((change) => ({ id: change.toolId, name: change.tool.name, quantity: Number(change.quantity), unitCost: Number(change.unitCost) })),
    materialConsumptions: order.materialConsumptions.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
    scrapPieces: scrap,
    now,
  }) : null;
  const thresholds = resolveQualityThresholds({
    useCompanyDefaults: order.estimate?.useCompanyQualityDefaults !== false,
    target: amount(order.estimate?.qualityTargetPercent),
    warningDelta: amount(order.estimate?.warningDeltaPercent),
    criticalDelta: amount(order.estimate?.criticalDeltaPercent),
    companyTarget: company.target,
    companyWarningDelta: company.warningDelta,
    companyCriticalDelta: company.criticalDelta,
  });
  const measured = (order.controlPlan?.controls ?? []).map((control) => {
    const values = control.measurements.map((measurement) => Number(measurement.value));
    const index = capability(values, Number(control.lowerLimit), Number(control.upperLimit));
    return { control, values, index };
  });
  const best = measured.reduce<{ cpk: number; points: number[] } | null>((lowest, item) => {
    if (item.index?.status !== "indices") return lowest;
    if (lowest && item.index.cpk >= lowest.cpk) return lowest;
    return { cpk: item.index.cpk, points: qualityIndexSeries(item.values, Number(item.control.lowerLimit), Number(item.control.upperLimit)) };
  }, null);
  const cpk = best?.cpk ?? null;
  const qualityPoints = best?.points ?? [];
  const controls = measured.map(({ control, values }) => {
    const latest = values.at(-1);
    const outside = latest !== undefined && (latest < Number(control.lowerLimit) || latest > Number(control.upperLimit));
    return {
      key: control.id,
      title: control.name,
      detail: latest === undefined ? t("dashboard.kpi.empty") : `${latest} · ${control.lowerLimit}–${control.upperLimit}`,
      color: outside ? "#FF4D4F" : "#00E676",
      outside,
      latest,
    };
  });
  const qualityState: DeliveryQuality = cpk !== null && thresholds ? interpretQuality(qualityPercentFromCpk(cpk), thresholds.target, thresholds.warningDelta, thresholds.criticalDelta) : null;
  const quality = cpk === null || !thresholds
    ? emptyKpi()
    : {
      value: `${qualityPercentFromCpk(cpk)}%`,
      status: t(`dashboard.kpiLabel.quality.${qualityState ?? "critical"}`),
      note: `Cpk ${cpk.toFixed(2)}`,
      color: qualityState === "critical" || qualityState === "poor" ? "#FF4D4F" : qualityState === "moderate" ? "#FF9800" : "#00E676",
      ring: qualityPercentFromCpk(cpk),
    };
  const scrapHit = signals.find((signal) => signal.code === "scrapHistory");
  const scrapKpi = produced <= 0
    ? emptyKpi()
    : {
      value: `${Math.round((scrap / produced) * 100)}%`,
      status: !scrapHit ? t("dashboard.kpiLabel.scrap.low") : scrapHit.severity === "critical" ? t("dashboard.kpiLabel.scrap.high") : t("dashboard.kpiLabel.scrap.moderate"),
      note: `${produced} · ${scrap}`,
      color: !scrapHit ? "#00E676" : scrapHit.severity === "critical" ? "#FF4D4F" : "#FF9800",
      ring: Math.round((scrap / produced) * 100),
    };
  const ratio = economics?.time.estimated && economics.time.estimated > 0 ? economics.time.actual / economics.time.estimated : null;
  const efficiency = ratio === null
    ? emptyKpi()
    : {
      value: ratio > 2 ? `${trim(ratio)}×` : `${Math.round(ratio * 100)}%`,
      status: ratio <= 1.1 ? t("dashboard.kpiLabel.efficiency.onTarget") : ratio <= 1.5 ? t("dashboard.kpiLabel.efficiency.watch") : t("dashboard.kpiLabel.efficiency.offTarget"),
      note: `${Math.round(economics?.time.actual ?? 0)} / ${Math.round(economics?.time.estimated ?? 0)}`,
      color: ratio <= 1.1 ? "#00E676" : ratio <= 1.5 ? "#FF9800" : "#FF4D4F",
      ring: Math.min(100, Math.round(ratio * 100)),
    };
  const toolSignals = signals.filter((signal) => signal.kind === "tooling");
  const toolPlan = economics?.tools.reduce((sum, line) => sum + (line.estimated ?? 0), 0) ?? 0;
  const toolUsed = economics?.tools.reduce((sum, line) => sum + (line.actual ?? 0), 0) ?? 0;
  const tools = {
    value: String(toolSignals.filter((signal) => signal.severity !== "info").length),
    status: toolSignals.some((signal) => signal.severity === "critical") ? t("dashboard.kpiLabel.tools.high") : toolSignals.length > 0 ? t("dashboard.kpiLabel.tools.moderate") : t("dashboard.kpiLabel.tools.good"),
    note: `${Math.max(0, toolPlan - toolUsed)} · ${toolUsed}`,
    color: toolSignals.some((signal) => signal.severity === "critical") ? "#FF4D4F" : toolSignals.length > 0 ? "#FF9800" : "#00E676",
    ring: toolPlan <= 0 ? (toolUsed > 0 ? 100 : 0) : Math.min(100, (toolUsed / toolPlan) * 100),
  };
  const materialPlan = economics?.materials.reduce((sum, line) => sum + (line.estimated ?? 0), 0) ?? 0;
  const materialUsed = economics?.materials.reduce((sum, line) => sum + (line.actual ?? 0), 0) ?? 0;
  const coverage = materialPlan <= 0 ? null : (Math.max(0, materialPlan - materialUsed) / materialPlan) * 100;
  const materialSignal = signals.some((signal) => signal.code === "materialSuggestion");
  const materials = coverage === null
    ? emptyKpi()
    : {
      value: `${Math.round(coverage)}%`,
      status: signals.some((signal) => signal.code === "materialSuggestion" && signal.severity === "critical")
        ? t("dashboard.kpiLabel.materials.critical")
        : materialSignal ? t("dashboard.kpiLabel.materials.moderate") : t("dashboard.kpiLabel.materials.good"),
      note: `${trim(Math.max(0, materialPlan - materialUsed))} · ${trim(materialUsed)}`,
      color: signals.some((signal) => signal.code === "materialSuggestion" && signal.severity === "critical") ? "#FF4D4F" : materialSignal ? "#FF9800" : "#00E676",
      ring: coverage,
    };
  const qualityForDelivery: DeliveryQuality = qualityState;
  const materialRisk: RiskLevel = signals.some((signal) => signal.code === "materialSuggestion" && signal.severity === "critical") ? "critical" : signals.some((signal) => signal.code === "materialSuggestion") ? "moderate" : "none";
  const toolRisk: RiskLevel = toolSignals.some((signal) => signal.severity === "critical") ? "critical" : toolSignals.length > 0 ? "moderate" : "none";
  const deliveryScore = order.plannedDeliveryAt && economics
    ? deliveryProbability({
      progress: order.targetQuantity > 0 ? good / order.targetQuantity : 0,
      efficiencyRatio: economics.time.estimated && economics.time.estimated > 0 ? economics.time.actual / economics.time.estimated : null,
      qualityState: qualityForDelivery,
      materialRisk,
      toolRisk,
      daysRemaining: daysRemaining(now, order.plannedDeliveryAt),
      estimatedRemainingTime: economics.time.estimated === null ? 0 : Math.max(0, economics.time.estimated - economics.time.actual),
      timeUnit,
    })
    : null;
  const delivery = deliveryScore === null
    ? emptyKpi()
    : {
      value: `${deliveryScore.percent}%`,
      status: t(`dashboard.kpiLabel.delivery.${deliveryScore.band}`),
      note: completion,
      color: deliveryScore.band === "high" ? "#00E676" : deliveryScore.band === "moderate" ? "#FF9800" : "#FF4D4F",
      ring: deliveryScore.percent,
    };
  const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const timeline = [
    ...machineTimes.map((row) => ({ key: row.id, at: row.startedAt, title: t("process.event.started"), detail: row.machine.name, color: "#00E676" })),
    ...order.toolChanges.map((row) => ({ key: row.id, at: row.occurredAt, title: t("process.event.tool"), detail: row.tool.name, color: "#FF9800" })),
    ...order.scraps.map((row) => ({ key: row.id, at: row.occurredAt, title: t("process.event.scrap"), detail: order.part.name, color: "#FF4D4F" })),
    ...order.materialConsumptions.map((row) => ({ key: row.id, at: row.occurredAt, title: t("process.event.material"), detail: row.material.name, color: "#3CF0FF" })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime());
  const cpkText = cpk === null ? null : cpk.toFixed(2);
  const qualityTarget = thresholds?.target ?? null;
  const qualityWarning = thresholds?.warningDelta ?? null;
  const qualityDelta = thresholds?.criticalDelta ?? null;
  const scrapValue = produced > 0 ? `${Math.round((scrap / produced) * 100)}%` : null;
  const efficiencyView = economics && economics.time.estimated !== null && economics.time.estimated > 0
    ? { percent: Math.round((economics.time.actual / economics.time.estimated) * 100), ratio: economics.time.actual / economics.time.estimated, actual: economics.time.actual, estimated: economics.time.estimated }
    : { percent: null, ratio: null, actual: null, estimated: null };
  const toolCount = toolSignals.length;
  const materialUnit = order.materialConsumptions[0]?.material.unit ?? order.estimate?.materialUses[0]?.material.unit ?? "";
  return {
    progress,
    tone,
    cpkText,
    qualityPoints,
    target: qualityTarget,
    warning: qualityWarning,
    delta: qualityDelta,
    scrapValue,
    scrapProduced: produced > 0 ? produced : null,
    scrapPieces: produced > 0 ? scrap : null,
    scrapPoints: scrapRiskSeries(produced, order.scraps),
    efficiencyView,
    efficiencyPoints: efficiencySeries(machineTimes, efficiencyView.estimated ?? 0, timeUnit),
    toolCount,
    toolActive: Math.max(0, toolPlan - toolUsed),
    toolReplaced: toolUsed,
    toolRisk: toolPlan <= 0 ? (toolUsed > 0 ? 100 : 0) : Math.min(100, (toolUsed / toolPlan) * 100),
    toolPoints: toolRiskSeries(toolPlan, order.toolChanges),
    materialCoverage: coverage,
    materialRemaining: Math.max(0, materialPlan - materialUsed),
    materialUsed,
    materialUnit,
    materialPoints: remainingSeries(materialPlan, order.materialConsumptions),
    deliveryCard: deliveryScore && order.plannedDeliveryAt ? { percent: deliveryScore.percent, band: deliveryScore.band, days: daysRemaining(now, order.plannedDeliveryAt), eta: order.plannedDeliveryAt } : null,
    score: gauge?.score ?? null,
    nextAction: advice(signals.find((signal) => signal.severity === "critical") ?? signals[0] ?? null),
    orderState,
    completion,
    quality,
    scrap: scrapKpi,
    efficiency,
    tools,
    materials,
    delivery,
    controls: controls.map(({ key, title, detail, color }) => ({ key, title, detail, color })),
    materialLines: (economics?.materials ?? []).map((line) => ({ key: line.id, title: line.name, detail: `${trim(line.actual ?? 0)} / ${line.estimated === null ? t("dashboard.kpi.empty") : trim(line.estimated)}`, color: "#3CF0FF" })),
    toolLines: (economics?.tools ?? []).map((line) => ({ key: line.id, title: line.name, detail: `${trim(line.actual ?? 0)} / ${line.estimated === null ? t("dashboard.kpi.empty") : trim(line.estimated)}`, color: "#FF9800" })),
    events: timeline.map((row) => ({ key: `event-${row.key}`, title: clock.format(row.at), detail: `${row.title} · ${row.detail}`, color: row.color })),
    nonconformities: [
      ...order.scraps.map((row) => ({ key: row.id, title: t("process.event.scrap"), detail: String(row.pieceCount), color: "#FF4D4F" })),
      ...controls.filter((control) => control.outside).map((control) => ({ key: `nc-${control.key}`, title: control.title, detail: control.detail, color: "#FF4D4F" })),
    ],
    timeline: timeline.map((row) => ({ key: row.key, title: clock.format(row.at), detail: `${row.title} · ${row.detail}`, color: row.color })),
  };
}

function emptyKpi() {
  return { value: t("dashboard.noData"), status: "", note: "", color: "#3CF0FF", ring: null };
}

function amount(value: { toString(): string } | null | undefined) {
  return value == null ? null : Number(value.toString());
}

function trim(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function advice(signal: CopilotSignal | null) {
  if (!signal) return t("process.normal");
  if (signal.kind === "quality") return t("process.action.quality");
  if (signal.kind === "tooling") return t("process.action.tool");
  if (signal.code === "time") return t("process.action.time");
  if (signal.code === "materialSuggestion") return t("process.action.material");
  if (signal.code === "downtime") return t("process.action.machine");
  return t("process.action.generic");
}
