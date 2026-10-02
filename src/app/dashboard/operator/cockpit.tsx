"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GaugeLegend } from "@/app/dashboard/gauge-visual";
import { t } from "@/lib/i18n";
import { loadOperationalMatch } from "@/lib/ppi-configuration";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { defaultDrawingMarkers, type DrawingMarker } from "@/lib/drawing-references";
import { saveOrderMarkers } from "@/server/order-actions";
import { alarmToneFlags, playAlarm, startSiren } from "@/lib/alarm-tones";
import { type CockpitSnapshot } from "@/lib/live-gauge";
import { evaluateProcessGauge, type ProcessDiagnosis } from "@/lib/process-gauge";
import { recordMeasurement as saveMeasurement, resetOrderMeasurements } from "@/server/quality-actions";
import { createProcessMemory, recordMeasurement as storeMeasurement } from "@/lib/process-memory";
import { readOutlook } from "@/lib/prediction";
import { recommendAction } from "@/lib/recommended-action";
import { canUseVoiceControl } from "@/lib/voice-policy";
import { RoleName } from "@prisma/client";

/** Voice / mic UI policy for this operator station: never for OPERATOR. OWNER-only via canUseVoiceControl. No speaker biometrics. */
export function cockpitVoiceControlAllowed(roles: { role: RoleName }[]) {
  return canUseVoiceControl(roles);
}

const card = "flex flex-col items-center justify-start rounded-xl border border-white/10 bg-[#050d18] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const touch = "min-h-10 rounded-lg border border-white/15 px-2 text-center text-[11px] font-medium uppercase leading-4 tracking-[0.16em]";
const title = "text-center text-[11px] font-medium uppercase leading-4 tracking-[0.22em] text-slate-500";
const cardTitle = "text-center text-[20px] font-medium uppercase leading-tight tracking-[0.06em] text-slate-400";
const primary = "text-center text-[30px] font-semibold leading-none tracking-tight text-white";
const stateText = "text-center text-[13px] font-semibold uppercase leading-5 tracking-[0.16em]";
const secondary = "text-center text-[11px] leading-4 text-slate-400";
const planButtonOn = "!border-[#3CF0FF] !bg-[#3CF0FF]/15 shadow-[0_0_12px_rgba(60,240,255,0.22)]";
const quotaIdle = "#F4F7F8";
const quotaSelected = "#3CF0FF";

function quotaBlank(nominal: string, lower: string, upper: string) {
  return Number(nominal) === 0 && Number(lower) === 0 && Number(upper) === 0;
}

function QuotaFigures({ nominal, lower, upper, place }: { nominal: string; lower: string; upper: string; place: string }) {
  const main = "min-w-0 truncate text-center font-semibold leading-none tabular-nums text-[clamp(1.35rem,2.4vw,2.75rem)]";
  const side = "min-w-0 truncate text-center font-medium leading-none tabular-nums text-[clamp(0.9rem,1.5vw,1.7rem)]";
  if (place === "right" || place === "left") {
    const range = `${lower} – ${upper}`;
    const nominalFirst = place === "right";
    return (
      <span className="grid w-full min-w-0 grid-cols-2 items-center gap-3">
        <span className={nominalFirst ? main : side}>{nominalFirst ? nominal : range}</span>
        <span className={nominalFirst ? side : main}>{nominalFirst ? range : nominal}</span>
      </span>
    );
  }
  return (
    <span className="grid w-full min-w-0 grid-cols-3 items-center gap-2">
      <span className={side}>{lower}</span>
      <span className={main}>{nominal}</span>
      <span className={side}>{upper}</span>
    </span>
  );
}

function quotaPlace(nominal: string, lower: string, upper: string) {
  const base = Number(nominal);
  const low = Number(lower) - base;
  const high = Number(upper) - base;
  if ((low < 0 && high > 0) || (low > 0 && high < 0)) return "middle";
  if (low >= 0 && high >= 0) return "right";
  return "left";
}

function quotaTone(nominal: string, lower: string, upper: string, value: number | null, selected: boolean) {
  if (selected) return quotaSelected;
  if (value === null || !Number.isFinite(value)) return quotaIdle;
  const target = Number(nominal);
  const min = Number(lower);
  const max = Number(upper);
  if (!Number.isFinite(target) || !Number.isFinite(min) || !Number.isFinite(max)) return quotaIdle;
  if (value < min || value > max) return "#FF4D4F";
  const half = Math.max(max - min, 0.0001) / 2;
  const position = Math.max(0, Math.min(1, 1 - Math.abs(value - target) / half)) * 100;
  return position >= 80 ? "#00E676" : "#FF9800";
}
const actionButton = "rounded-lg border border-white/20 bg-transparent px-2 text-center text-white transition hover:!border-[#3CF0FF] hover:bg-white/[0.06] hover:shadow-[0_0_12px_rgba(60,240,255,0.28)]";

const diagnosisKey: Record<ProcessDiagnosis, string> = {
  PROCESS_STABLE: "operations.diagnosis.stable",
  TREND_TOWARD_UPPER_LIMIT: "operations.diagnosis.upper",
  TREND_TOWARD_LOWER_LIMIT: "operations.diagnosis.lower",
  TOOL_WEAR_SUSPECTED: "operations.diagnosis.tool",
  THERMAL_DRIFT_DETECTED: "operations.diagnosis.thermal",
  INCREASING_VARIABILITY: "operations.diagnosis.variability",
  PROCESS_OUT_OF_CONTROL: "operations.diagnosis.out",
};

const emptySnapshot: CockpitSnapshot = {
  orderId: "",
  code: "",
  part: "",
  operator: "",
  machine: "",
  quantity: 0,
  worked: 0,
  produced: 0,
  remaining: 0,
  scrap: 0,
  tool: "",
  life: 100,
  runtime: 0,
  toolChanges: 0,
  measurements: [],
  target: 0,
  min: 0,
  max: 0,
  controls: [],
  markers: [],
  drawing: null,
};

export function Cockpit({ snapshot, alarmSound = true, alarmTone = "", criticalScreen = true, readOnly = false }: { snapshot: CockpitSnapshot | null; alarmSound?: boolean; alarmTone?: string; criticalScreen?: boolean; readOnly?: boolean }) {
  const job = snapshot ?? emptySnapshot;
  const [mode, setMode] = useState<"manual" | "usb" | "bluetooth">("manual");
  const [controlPlan] = useState(job.controls);
  const [measured, setMeasured] = useState("");
  const [sinceCheck, setSinceCheck] = useState("");
  const [sirenHeld, setSirenHeld] = useState(false);
  const [toolNote, setToolNote] = useState("");
  const [life, setLife] = useState(job.life);
  const [series, setSeries] = useState<Record<string, number[]>>(() => Object.fromEntries(job.controls.map((item) => [item.reference, item.values])));
  const [gaugeReference, setGaugeReference] = useState<string | null>(() => [...job.controls].sort((left, right) => right.values.length - left.values.length)[0]?.reference ?? null);
  const [marker, setMarker] = useState(0);
  const [toolEvents, setToolEvents] = useState(0);
  const [scrapCount] = useState(0);
  const [runtime] = useState(120);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [drawingZoom, setDrawingZoom] = useState(1);
  const [drawingMarkers, setDrawingMarkers] = useState<DrawingMarker[]>(defaultDrawingMarkers);
  const [drawingFile, setDrawingFile] = useState(job.drawing);
  useEffect(() => {
    const configuration = loadOperationalMatch(job.machine, job.code);
    if (job.markers.length > 0) setDrawingMarkers(job.markers);
    setMode(configuration.acquisition);
    if (configuration.showDrawing) setDrawingOpen(true);
  }, []);
  const [nextIn, setNextIn] = useState(1);
  const [selectedReference, setSelectedReference] = useState<string | null>(() => job.controls[0]?.reference ?? null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const letterRow = useRef<HTMLDivElement>(null);
  const letterProbe = useRef<HTMLButtonElement>(null);
  const measuredInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const probe = letterProbe.current;
    const row = letterRow.current;
    if (!probe || !row) return;
    row.style.setProperty("--letter-window", `${probe.offsetWidth}px`);
  }, [controlPlan]);
  const [lastValues, setLastValues] = useState<Record<string, number | null>>(() => Object.fromEntries(job.controls.map((item) => [item.reference, item.last])));
  const [selectedTool, setSelectedTool] = useState<"wear" | "breakage" | null>(null);
  const [produced, setProduced] = useState(job.produced);
  const [worked, setWorked] = useState(job.worked);
  const [remaining, setRemaining] = useState(job.remaining);
  useEffect(() => {
    if (!snapshot) return;
    setSeries(Object.fromEntries(snapshot.controls.map((item) => [item.reference, item.values])));
    setLastValues(Object.fromEntries(snapshot.controls.map((item) => [item.reference, item.last])));
    setWorked(snapshot.worked);
    setRemaining(snapshot.remaining);
    setProduced(snapshot.produced);
    setLife(snapshot.life);
  }, [snapshot]);
  const memory = useRef(createProcessMemory());
  const gaugeControl = controlPlan.find((item) => item.reference === gaugeReference);
  const measurements = series[gaugeReference ?? ""] ?? job.measurements;
  const gaugeMin = gaugeControl ? Number(gaugeControl.lower) : job.min;
  const gaugeMax = gaugeControl ? Number(gaugeControl.upper) : job.max;
  const gaugeTarget = gaugeControl ? Number(gaugeControl.nominal) : job.target;
  const gauge = evaluateProcessGauge({
    measurements,
    toleranceMin: gaugeMin,
    toleranceMax: gaugeMax,
    target: gaugeTarget,
    producedQuantity: produced,
    toolRemainingLife: life,
    scrapCount,
    machineRuntime: runtime,
    toolChangeEvents: toolEvents,
    trendMarker: marker,
  });
  const tone = gauge.score >= 80 ? "#00E676" : gauge.score >= 60 ? "#FF9800" : "#FF4D4F";
  const level = gauge.score >= 80 ? t("operations.stable") : gauge.score >= 60 ? t("operations.attention") : t("operations.critical");
  const diagnosis = diagnosisKey[gauge.diagnosis];
  const outlook = readOutlook({
    measurements,
    toleranceMin: gaugeMin,
    toleranceMax: gaugeMax,
    target: gaugeTarget,
    producedQuantity: produced,
    toolRemainingLife: life,
    scrapCount,
    machineRuntime: runtime,
    toolChangeEvents: toolEvents,
    trendMarker: marker,
    checkInterval: 20,
  });
  const action = recommendAction(gauge.diagnosis, gauge.score, outlook.context);
  const prediction = outlook.prediction;
  const superCritical = gauge.state === "CRITICAL" && (action.action === "operations.action.stop" || prediction.kind === "OUT_OF_TOLERANCE");
  const criticalGlow = criticalScreen && gauge.state === "CRITICAL";
  const alertStyle = gauge.state === "ATTENTION"
    ? { boxShadow: "0 0 0 4px rgba(255, 152, 0, 0.8)" }
    : !criticalScreen
      ? undefined
      : superCritical
        ? { animation: "ppi-alert-pulse 2.5s ease-in-out infinite" }
        : gauge.state === "CRITICAL"
          ? { boxShadow: "0 0 0 12px rgba(255, 77, 79, 0.14)" }
          : undefined;
  const tones = alarmToneFlags(alarmTone);
  const critical = gauge.state === "CRITICAL";
  const outside = measurements.slice(-10).some((value) => value < gaugeMin || value > gaugeMax);
  const sirenOn = alarmSound && tones.siren && !readOnly && outside && !sirenHeld;
  const [sirenSlot, setSirenSlot] = useState<HTMLElement | null>(null);
  const [resetSlot, setResetSlot] = useState<HTMLElement | null>(null);
  const [reportSlot, setReportSlot] = useState<HTMLElement | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  useEffect(() => {
    setSirenSlot(document.getElementById("ppi-siren-slot"));
    setResetSlot(document.getElementById("ppi-reset-slot"));
    setReportSlot(document.getElementById("ppi-report-slot"));
  }, []);
  useEffect(() => {
    if (!outside) setSirenHeld(false);
  }, [outside]);
  useEffect(() => {
    if (!sirenOn) return;
    return startSiren();
  }, [sirenOn]);
  const due = nextIn <= 0;
  const predictionStatus = t(prediction.headline).replace(" EXPECTED", "");
  const predictionState = prediction.pieces !== undefined ? `${predictionStatus} ${t("operations.prediction.in")}` : "";
  const predictionPrimary = prediction.pieces !== undefined
    ? `${prediction.pieces} ${t("operations.prediction.pcs")}`
    : prediction.detail
      ? t(prediction.detail)
      : predictionStatus;
  const valueReady = measured.trim() !== "";

  async function recordMeasurement() {
    if (readOnly || saving) return;
    const value = Number(measured.replace(",", "."));
    const active = controlPlan.find((item) => item.reference === selectedReference) ?? controlPlan[0];
    if (!active) return;
    const typed = sinceCheck.trim() === "" ? active.every : Number(sinceCheck.replace(",", "."));
    const pieces = Number.isFinite(typed) && typed >= 0 ? typed : 0;
    if (mode !== "manual" || !valueReady || !Number.isFinite(value)) return;
    setSaving(true);
    setSaveNote("");
    const form = new FormData();
    form.set("controlId", active.id);
    form.set("value", String(value));
    const error = await saveMeasurement(null, form);
    setSaving(false);
    if (error) {
      setSaveNote(t(error));
      return;
    }
    const nextProduced = produced + pieces;
    const nextRemaining = Math.max(0, remaining - pieces);
    setProduced(nextProduced);
    setWorked(worked + pieces);
    setRemaining(nextRemaining);
    setSeries((current) => ({ ...current, [active.reference]: [...(current[active.reference] ?? []), value].slice(-10) }));
    setGaugeReference(active.reference);
    setNextIn((current) => Math.max(0, current - pieces));
    storeMeasurement(memory.current, {
      operatorId: "operator-1",
      machineId: job.machine,
      orderId: job.code,
      jobId: job.orderId,
      partId: job.part,
      dimensionCode: active.reference,
      dimensionName: active.callout,
      target: Number(active.nominal),
      minimumTolerance: Number(active.lower),
      maximumTolerance: Number(active.upper),
      measuredValue: value,
      producedQuantity: nextProduced,
      piecesSinceLastCheck: pieces,
      toolId: job.tool,
    });
    const criticalValue = value < Number(active.lower) || value > Number(active.upper);
    setLastValues((current) => ({ ...current, [active.reference]: value }));
    const index = controlPlan.findIndex((item) => item.reference === active.reference);
    const following = controlPlan[index + 1] ?? controlPlan[0];
    setSelectedReference(following?.reference ?? active.reference);
    if (alarmSound && (criticalValue ? tones.burst : tones.high)) playAlarm(criticalValue ? "burst" : "high");
    setMeasured("");
    setSinceCheck("");
    setSaveNote(t("operations.saved"));
    measuredInput.current?.focus();
  }

  async function resetMeasurements() {
    if (readOnly || resetting || !job.orderId) return;
    setResetting(true);
    setSaveNote("");
    const error = await resetOrderMeasurements(job.orderId);
    setResetting(false);
    if (error) {
      setSaveNote(t(error));
      return;
    }
    memory.current = createProcessMemory();
    setSeries(Object.fromEntries(controlPlan.map((item) => [item.reference, []])));
    setLastValues(Object.fromEntries(controlPlan.map((item) => [item.reference, null])));
    setGaugeReference(controlPlan[0]?.reference ?? null);
    setWorked(0);
    setProduced(0);
    setRemaining(job.quantity);
    setMeasured("");
    setSinceCheck("");
    setNextIn(1);
    setMarker(0);
    setSirenHeld(false);
    setSaveNote("");
  }

  function replaceTool() {
    if (readOnly) return;
    setLife(100);
    setMarker(measurements.length);
    setToolEvents((count) => count + 1);
    setToolNote(t("operations.toolRecorded"));
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {alertStyle ? <div className="pointer-events-none absolute inset-0 rounded-2xl" style={alertStyle} /> : null}
    <div className="relative flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-2xl bg-[var(--ppi-canvas,#040b16)] p-3 font-sans text-slate-100">
      {criticalGlow ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
          <div className="ppi-critical-radiate" />
          <div className="ppi-critical-dots" />
        </div>
      ) : null}
      {reportSlot && job.orderId ? createPortal(
        <button type="button" onClick={() => setReportOpen(true)} className="whitespace-nowrap rounded-full border border-stone-500 bg-stone-200 px-3 py-1 text-[12px] font-medium text-stone-900">
          {t("operations.measurementReport")}
        </button>,
        reportSlot,
      ) : null}
      {!readOnly && resetSlot && job.orderId ? createPortal(
        <button type="button" onClick={() => void resetMeasurements()} disabled={resetting} className="whitespace-nowrap rounded-full border border-stone-500 bg-stone-200 px-3 py-1 text-[12px] font-medium text-stone-900 disabled:opacity-40">
          {t("operations.resetMeasurements")}
        </button>,
        resetSlot,
      ) : null}
      {sirenOn && sirenSlot ? createPortal(
        <button type="button" onClick={() => setSirenHeld(true)} className="whitespace-nowrap rounded-full border border-[#FF4D4F] bg-stone-200 px-4 py-1 text-[12px] font-medium uppercase tracking-[0.14em] text-[#FF4D4F]">
          {t("operations.sirenStop")}
        </button>,
        sirenSlot,
      ) : null}
      {!snapshot ? <p className="relative text-center text-[14px] text-slate-400">{t("operations.emptyOrder")}</p> : null}
      <header className="relative grid shrink-0 grid-cols-6 gap-2">
        <Fact label={t("operations.operator")} value={job.operator} />
        <Fact label={t("operations.machine")} value={job.machine} />
        <Fact label={t("operations.job")} value={job.code} />
        <Fact label={t("operations.orderPieces")} value={String(job.quantity)} />
        <Fact label={t("operations.worked")} value={String(worked)} />
        <Fact label={t("operations.remaining")} value={String(remaining)} />
      </header>
      <div className="relative grid min-h-0 flex-1 grid-cols-8 grid-rows-[minmax(0,1.65fr)_minmax(0,1fr)] gap-1.5 overflow-hidden">
          <div ref={letterRow} className="col-span-8 grid min-h-0 grid-cols-[minmax(0,1.45fr)_max-content_minmax(0,1fr)_minmax(0,1fr)] gap-x-1.5" style={{ gridTemplateRows: `auto repeat(${Math.max(controlPlan.length, 1)}, minmax(0, 1fr))` }}>
          <section className={`${card} row-span-full !grid h-full min-h-0 !items-stretch grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)] grid-rows-subgrid gap-x-3 !p-0 border-2 border-white/10 px-3 pb-2`}>
              <p className={`${cardTitle} col-span-2 flex items-end pb-2 pt-3 !text-left`}>{t("operations.controlNow")}</p>
                {controlPlan.map((item) => {
                  const selected = selectedReference === item.reference;
                  const blank = quotaBlank(item.nominal, item.lower, item.upper);
                  const place = quotaPlace(item.nominal, item.lower, item.upper);
                  const tone = quotaTone(item.nominal, item.lower, item.upper, lastValues[item.reference] ?? null, selected);
                  const toneStyle = { color: tone, borderColor: tone, backgroundColor: selected ? "rgba(60,240,255,0.15)" : "transparent" };
                  return (
                  <div key={item.reference} className="contents">
                    <button ref={item.reference === controlPlan[0]?.reference ? letterProbe : undefined} type="button" onClick={() => { if (!readOnly) setSelectedReference(item.reference); }} style={toneStyle} className={`my-1 flex h-full min-h-12 w-full min-w-0 items-center self-stretch rounded-md border bg-transparent px-2 text-left text-[clamp(0.95rem,1.3vw,1.25rem)] font-semibold leading-none transition hover:bg-white/[0.04] ${readOnly ? "pointer-events-none" : ""}`}>
                      <span className="shrink-0">{`${item.reference}  ➜`}</span>
                      {blank ? null : <span className="ml-2 min-w-0 truncate">{item.callout}</span>}
                    </button>
                    <div style={toneStyle} className="my-1 flex h-full min-h-12 w-full min-w-0 items-center self-stretch rounded-md border px-3">
                      {blank ? <span className="w-full text-center text-[clamp(1rem,1.4vw,1.25rem)] font-medium tracking-[0.2em]">-----</span> : (
                        <QuotaFigures nominal={item.nominal} lower={item.lower} upper={item.upper} place={place} />
                      )}
                    </div>
                  </div>
                  );
                })}
          </section>
          <section className={`${card} row-span-full !grid h-full min-h-0 w-max grid-rows-subgrid !items-stretch !justify-items-stretch !p-0 border-2 px-3 pb-2 ${due ? "border-[#FF4D4F]" : "border-white/10"}`} style={due ? { animation: "ppi-soft-pulse 1.8s ease-in-out infinite" } : undefined}>
              <p className={`${cardTitle} flex items-end justify-center pb-2 pt-3`}>{t("operations.controlRequired")}</p>
                {controlPlan.map((item) => {
                  const selected = selectedReference === item.reference;
                  const blank = quotaBlank(item.nominal, item.lower, item.upper);
                  const tone = quotaTone(item.nominal, item.lower, item.upper, lastValues[item.reference] ?? null, selected);
                  const frequency = blank ? "" : item.every > 0 ? `${item.every} ${t("operations.prediction.pcs")}` : item.callout;
                  return (
                  <button key={item.reference} type="button" onClick={() => { if (readOnly) return; setSelectedReference(item.reference); setSinceCheck(String(item.every)); }} style={{ color: tone, borderColor: tone, backgroundColor: selected ? "rgba(60,240,255,0.15)" : "transparent" }} className={`my-1 flex h-full min-h-12 w-max items-center self-stretch rounded-md border border-white/20 bg-transparent px-3 text-left text-[clamp(0.95rem,1.3vw,1.25rem)] font-semibold leading-none transition hover:bg-white/[0.04] ${readOnly ? "pointer-events-none" : ""}`}>
                    <span className="whitespace-pre">{`${item.reference}  ➜`}</span>
                    {frequency ? <span className="ml-2 whitespace-nowrap">{frequency}</span> : null}
                  </button>
                  );
                })}
          </section>
          <section className={`${card} row-span-full h-full min-h-0 !justify-stretch !p-0`}>
            {mode === "manual" ? (
              <div className="flex h-full min-h-0 w-full flex-col px-3 pb-3 pt-3">
                <label className="flex min-h-0 flex-1 flex-col">
                  <span className={cardTitle}>{t("operations.measured")}</span>
                  <input ref={measuredInput} value={measured} readOnly={readOnly} onChange={(event) => { if (readOnly) return; setMeasured(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") void recordMeasurement(); }} inputMode="decimal" className="mt-3 min-h-16 w-full flex-1 rounded-lg border border-[#232830] bg-[#040b16] px-3 text-center text-[clamp(1.75rem,5vh,4rem)] font-semibold tracking-tight text-white outline-none" />
                </label>
                <button type="button" onClick={() => void recordMeasurement()} disabled={readOnly || saving || mode !== "manual" || controlPlan.length === 0 || !valueReady} className={`${cardTitle} mt-3 h-12 w-full rounded-lg bg-[#163F56] px-2 !text-[#F4F7F8] hover:bg-[#1B465E] disabled:opacity-40`}>{t("operations.saveMeasurement")}</button>
                {saveNote ? <p className="mt-2 text-center text-[13px] text-[#3CF0FF]">{saveNote}</p> : null}
              </div>
            ) : (
              <p className={`${stateText} m-auto`}>{t("operations.waiting")}</p>
            )}
          </section>
          <section className={`${card} row-span-full h-full min-h-0 !flex-row items-stretch overflow-hidden !border-2 !p-0`}>
            <div className="flex w-[70%] flex-col items-center px-2 pt-3">
              <p className={cardTitle}>{t("operations.prediction")}</p>
              <p className={`${primary} mt-2.5 text-[#3CF0FF]`}>{predictionPrimary}</p>
              {predictionState ? <p className={`${stateText} mt-2.5 text-[#3CF0FF]`}>{predictionState}</p> : null}
            </div>
            <div className="flex w-[30%] flex-col items-center border-l border-white/15 px-2 pt-3">
              <p className={cardTitle}>{t("operations.scrap")}</p>
              <p className={`${primary} mt-2.5 text-[#FF4D4F]`}>{job.scrap + scrapCount}</p>
            </div>
          </section>
          </div>
          <section className={`${card} col-span-3 h-full min-h-0 gap-2 overflow-auto !justify-between`}>
            <p className={cardTitle}>{t("operations.gauge")}</p>
            <p className={`${primary} !text-[38px]`} style={{ color: tone }}>{gauge.score}</p>
            <p className={`${stateText} !text-[21px] !leading-none`} style={{ color: tone }}>{level}</p>
            <GaugeLegend />
            <p className={`${stateText} !text-[21px] !leading-none text-white`}>{t(diagnosis)}</p>
            <p className={`${secondary} !text-[21px] !leading-none`}>{`${t("operations.drift")} ${gauge.drift} · ${t("operations.variability")} ${gauge.variability}`}</p>
          </section>
          <section className={`${card} col-span-3 h-full min-h-0 gap-2 overflow-auto !justify-between`}>
            <p className={cardTitle}>{t("operations.activeTool")}</p>
            <p className={`${primary} !text-[38px]`} style={{ color: life > 20 ? "#00E676" : "#FF9800" }}>{life}%</p>
            <p className={`${stateText} !text-[21px] !leading-none text-white`}>{job.tool}</p>
            <p className={`${secondary} !text-[21px] !leading-none`}>{t("operations.remainingLife")}</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={() => { if (readOnly) return; replaceTool(); setSelectedTool("wear"); }} className={`${actionButton} !min-h-10 !text-[19px] font-medium uppercase ${readOnly ? "pointer-events-none" : ""} ${selectedTool === "wear" ? planButtonOn : ""}`}>{t("operations.wear")}</button>
              <button type="button" onClick={() => { if (readOnly) return; replaceTool(); setSelectedTool("breakage"); }} className={`${actionButton} !min-h-10 !text-[19px] font-medium uppercase ${readOnly ? "pointer-events-none" : ""} ${selectedTool === "breakage" ? planButtonOn : ""}`}>{t("operations.breakage")}</button>
            </div>
            {toolNote ? <p className={`${secondary} mt-1 !text-[13px] text-[#00E676]`}>{toolNote}</p> : null}
          </section>
          <section className={`${card} col-span-2 h-full min-h-0 overflow-auto`}>
            <p className={cardTitle}>{t("operations.recommended")}</p>
            <p className={`${primary} mt-2.5`}>{t(action.action)}</p>
            <p className={`${stateText} mt-2.5 text-white`}>{`${t("operations.confidence")} ${action.confidence}%`}</p>
            <div className="mt-auto flex w-full flex-col gap-2 pt-3">
              <button type="button" onClick={() => { setDrawingZoom(1); setDrawingOpen(true); }} className={`${stateText} text-[#3CF0FF]`}>{t("operations.openDrawing")}</button>
            </div>
          </section>
        </div>
        {reportOpen ? (
          <MeasurementReport
            controls={controlPlan.map((item) => ({ ...item, values: series[item.reference] ?? item.values }))}
            onClose={() => setReportOpen(false)}
          />
        ) : null}
        {drawingOpen ? (
          <div className="fixed inset-0 z-[80] flex h-dvh w-dvw flex-col gap-2 overflow-hidden bg-[#040b16] p-3">
            <div className="flex shrink-0 items-center justify-between">
              <p className={title}>{t("operations.drawing")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDrawingZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))} className={`${touch} text-white`}>{t("operations.zoomOut")}</button>
                <button type="button" onClick={() => setDrawingZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))} className={`${touch} text-white`}>{t("operations.zoomIn")}</button>
                <button type="button" onClick={() => setDrawingOpen(false)} className={`${touch} bg-[#3CF0FF] text-[#041018]`}>{t("operations.return")}</button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <MarkerBoard
                fit
                zoom={drawingZoom}
                locked={readOnly}
                markers={drawingMarkers}
                drawing={drawingFile}
                onFile={readOnly ? undefined : (file) => {
                  if (drawingFile) URL.revokeObjectURL(drawingFile.url);
                  setDrawingFile({ url: URL.createObjectURL(file), kind: file.type === "application/pdf" ? "pdf" : "image" });
                }}
                onChange={(next) => {
                  if (readOnly) return;
                  setDrawingMarkers(next);
                  if (job.orderId) void saveOrderMarkers(job.orderId, next);
                }}
              />
            </div>
            <p className={`mx-auto shrink-0 rounded-lg border-2 border-[#3CF0FF] px-4 py-2 text-center text-[#3CF0FF] ${primary}`}>{`A • ${controlPlan[0]?.callout ?? ""}`}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function measureLabel(value: number) {
  return String(Number(value.toFixed(3)));
}

function MeasurementReport({ controls, onClose }: { controls: { reference: string; callout: string; nominal: string; lower: string; upper: string; values: number[] }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[85] flex h-dvh w-dvw flex-col overflow-hidden bg-[#040b16] p-3 text-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className={title}>{t("operations.measurementReport")}</p>
        <button type="button" onClick={onClose} className={`${touch} bg-[#3CF0FF] text-[#041018]`}>{t("operations.return")}</button>
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap gap-4 text-[13px]">
        <Legend swatch="#00E676" label={t("operations.measurementReport.in")} />
        <Legend swatch="#FF9800" label={t("operations.measurementReport.near")} />
        <Legend swatch="#FF4D4F" label={t("operations.measurementReport.out")} />
        <Legend swatch="#3CF0FF" label={t("operations.measurementReport.nominal")} />
        <Legend swatch="#94a3b8" label={t("operations.measurementReport.limits")} />
      </div>
      <div className="mt-3 grid min-h-0 flex-1 auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-3 overflow-auto">
        {controls.map((item) => (
          <section key={item.reference} className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-[#050d18] p-3">
            <p className="text-[28px] font-semibold leading-none text-white">{item.reference}</p>
            <p className="mt-1 truncate text-[15px] text-slate-300">{item.callout}</p>
            <p className="mt-1 text-[13px] tabular-nums text-slate-500">{`${item.lower} – ${item.upper}`}</p>
            <TrendChart nominal={item.nominal} lower={item.lower} upper={item.upper} values={item.values} />
            {item.values.length === 0 ? <p className="mt-4 text-[14px] text-slate-500">{t("operations.measurementReport.empty")}</p> : (
              <ol className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
                {item.values.map((value, index) => {
                  const tone = quotaTone(item.nominal, item.lower, item.upper, value, false);
                  return (
                    <li key={`${item.reference}-${index}`} style={{ color: tone, borderColor: tone }} className="flex items-center justify-between rounded-md border bg-black/20 px-3 py-2">
                      <span className="text-[13px] text-slate-500">{index + 1}</span>
                      <span className="text-[clamp(1.15rem,2vw,1.7rem)] font-semibold leading-none tabular-nums">{measureLabel(value)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ nominal, lower, upper, values }: { nominal: string; lower: string; upper: string; values: number[] }) {
  const target = Number(nominal);
  const min = Number(lower);
  const max = Number(upper);
  const samples = values.filter((value) => Number.isFinite(value));
  const bounds = [min, max, target, ...samples].filter((value) => Number.isFinite(value));
  if (bounds.length === 0) return null;
  const low = Math.min(...bounds);
  const high = Math.max(...bounds);
  const span = Math.max(high - low, 0.0001);
  const y0 = low - span * 0.18;
  const y1 = high + span * 0.18;
  const width = 320;
  const height = 150;
  const plot = { left: 12, right: 58, top: 12, bottom: 16 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const yOf = (value: number) => plot.top + ((y1 - value) / (y1 - y0)) * plotHeight;
  const xOf = (index: number) => samples.length <= 1 ? plot.left + plotWidth / 2 : plot.left + (index / (samples.length - 1)) * plotWidth;
  const guides = [
    { value: max, color: "#94a3b8" },
    { value: min, color: "#94a3b8" },
    { value: target, color: "#3CF0FF" },
  ].filter((guide) => Number.isFinite(guide.value));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 aspect-[2/1] w-full" role="img">
      {guides.map((guide) => (
        <g key={`${guide.color}-${guide.value}`}>
          <line x1={plot.left} x2={width - plot.right} y1={yOf(guide.value)} y2={yOf(guide.value)} stroke={guide.color} strokeDasharray={guide.color === "#3CF0FF" ? "4 3" : undefined} strokeWidth="1" />
          <text x={width - plot.right + 6} y={yOf(guide.value) + 4} fill={guide.color} fontSize="11">{measureLabel(guide.value)}</text>
        </g>
      ))}
      {samples.length > 1 ? <polyline fill="none" stroke="#e2e8f0" strokeWidth="1.5" points={samples.map((value, index) => `${xOf(index)},${yOf(value)}`).join(" ")} /> : null}
      {samples.map((value, index) => (
        <circle key={index} cx={xOf(index)} cy={yOf(value)} r="4.5" fill={quotaTone(nominal, lower, upper, value, false)} />
      ))}
    </svg>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: swatch }} />
      <span>{label}</span>
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#050d18] px-2 py-1 text-center">
      <p className={title}>{label}</p>
      <p className={`truncate text-white ${stateText}`}>{value}</p>
    </div>
  );
}

