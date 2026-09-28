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
import { recordMeasurementForm } from "@/server/quality-actions";
import { createProcessMemory, recordMeasurement as storeMeasurement } from "@/lib/process-memory";
import { readOutlook } from "@/lib/prediction";
import { recommendAction } from "@/lib/recommended-action";

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
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const letterRow = useRef<HTMLDivElement>(null);
  const letterProbe = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    setSirenSlot(document.getElementById("ppi-siren-slot"));
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

  function recordMeasurement() {
    if (readOnly) return;
    const value = Number(measured.replace(",", "."));
    const active = controlPlan.find((item) => item.reference === selectedReference);
    if (!active) return;
    const typed = sinceCheck.trim() === "" ? active.every : Number(sinceCheck.replace(",", "."));
    const pieces = Number.isFinite(typed) && typed >= 0 ? typed : 0;
    if (mode !== "manual" || !valueReady || !Number.isFinite(value)) return;
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
    const form = new FormData();
    form.set("controlId", active.id);
    form.set("value", String(value));
    void recordMeasurementForm(form);
    const criticalValue = value < Number(active.lower) || value > Number(active.upper);
    setLastValues((current) => ({ ...current, [active.reference]: value }));
    setSelectedReference(null);
    if (!readOnly && alarmSound && (criticalValue ? tones.burst : tones.high)) playAlarm(criticalValue ? "burst" : "high");
    setMeasured("");
    setSinceCheck("");
  }

  function replaceTool() {
    if (readOnly) return;
    setLife(100);
    setMarker(measurements.length);
    setToolEvents((count) => count + 1);
    setToolNote(t("operations.toolRecorded"));
  }

  if (!snapshot) return <p className="px-4 py-8 text-center text-[16px] text-slate-300">{t("operations.emptyOrder")}</p>;

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] min-h-0">
      {alertStyle ? <div className="pointer-events-none absolute inset-0 rounded-2xl" style={alertStyle} /> : null}
    <div className="relative flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-2xl bg-[var(--ppi-canvas,#040b16)] p-3 font-sans text-slate-100">
      {criticalGlow ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
          <div className="ppi-critical-radiate" />
          <div className="ppi-critical-dots" />
        </div>
      ) : null}
      {sirenOn && sirenSlot ? createPortal(
        <button type="button" onClick={() => setSirenHeld(true)} className="whitespace-nowrap rounded-full border border-[#FF4D4F] bg-stone-200 px-4 py-1 text-[12px] font-medium uppercase tracking-[0.14em] text-[#FF4D4F]">
          {t("operations.sirenStop")}
        </button>,
        sirenSlot,
      ) : null}
      <header className="relative grid shrink-0 grid-cols-6 gap-2">
        <Fact label={t("operations.operator")} value={job.operator} />
        <Fact label={t("operations.machine")} value={job.machine} />
        <Fact label={t("operations.job")} value={job.code} />
        <Fact label={t("operations.orderPieces")} value={String(job.quantity)} />
        <Fact label={t("operations.worked")} value={String(worked)} />
        <Fact label={t("operations.remaining")} value={String(remaining)} />
      </header>
      <div className="relative grid h-full min-h-0 flex-1 grid-rows-[auto_auto_auto_auto_auto] content-start gap-1.5 overflow-hidden">
        <div className="grid min-h-0 grid-cols-8 gap-1.5">
          <div ref={letterRow} className="col-span-8 grid grid-cols-[minmax(0,1.45fr)_auto_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
          <section className={`${card} !p-0 border-2 border-white/10`} style={{ minHeight: 480 }}>
            <div className="flex min-h-[480px] w-full flex-1 flex-col items-stretch px-3 pt-3">
              <p className={`${cardTitle} shrink-0 !text-left`}>{t("operations.controlNow")}</p>
              <div className="grid w-full flex-1 grid-cols-[max-content_minmax(0,1fr)] grid-rows-5 items-center gap-x-2 py-3 text-left text-[20px] font-semibold leading-none">
                {controlPlan.map((item) => {
                  const selected = selectedReference === item.reference;
                  const blank = quotaBlank(item.nominal, item.lower, item.upper);
                  const place = quotaPlace(item.nominal, item.lower, item.upper);
                  const tone = quotaTone(item.nominal, item.lower, item.upper, lastValues[item.reference] ?? null, selected);
                  const toneStyle = { color: tone, borderColor: tone, backgroundColor: selected ? "rgba(60,240,255,0.15)" : "transparent" };
                  return (
                  <div key={item.reference} className="contents">
                    <button ref={item.reference === controlPlan[0]?.reference ? letterProbe : undefined} type="button" onClick={() => { if (!readOnly) setSelectedReference(item.reference); }} style={toneStyle} className={`flex h-[38px] w-full items-center rounded-md border bg-transparent px-2 text-left text-[20px] font-semibold leading-none transition hover:bg-white/[0.04] ${readOnly ? "pointer-events-none" : ""}`}>
                      <span className="whitespace-pre">{`${item.reference}  ➜`}</span>
                      {blank ? null : <span className="ml-2 whitespace-nowrap">{item.callout}</span>}
                    </button>
                    <div style={toneStyle} className={`flex w-[calc(100%-100px)] justify-self-center items-center rounded-md border px-2 ${blank ? "justify-center py-2" : "h-[78px]"}`}>
                      {blank ? <span className="text-[20px] font-medium tracking-[0.2em]">-----</span> : place === "right" ? (
                        <>
                          <span className="text-[53px] font-semibold leading-none">{item.nominal}</span>
                          <span className="flex-1" />
                          <span className="mr-[1.45em] text-[31px] font-medium leading-none">{`${item.lower} – ${item.upper}`}</span>
                        </>
                      ) : place === "left" ? (
                        <>
                          <span className="ml-[1.45em] text-[31px] font-medium leading-none">{`${item.lower} – ${item.upper}`}</span>
                          <span className="flex-1" />
                          <span className="text-[53px] font-semibold leading-none">{item.nominal}</span>
                        </>
                      ) : (
                        <>
                          <span className="ml-[1.45em] text-[31px] font-medium leading-none">{item.lower}</span>
                          <span className="flex-1" />
                          <span className="text-[53px] font-semibold leading-none">{item.nominal}</span>
                          <span className="flex-1" />
                          <span className="mr-[1.45em] text-[31px] font-medium leading-none">{item.upper}</span>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </section>
          <section className={`${card} w-max !p-0 border-2 ${due ? "border-[#FF4D4F]" : "border-white/10"}`} style={due ? { minHeight: 480, animation: "ppi-soft-pulse 1.8s ease-in-out infinite" } : { minHeight: 480 }}>
            <div className="flex min-h-[480px] w-full flex-1 flex-col items-stretch px-2 pt-3">
              <p className={`${cardTitle} shrink-0`}>{t("operations.controlRequired")}</p>
              <div className="grid w-full flex-1 grid-rows-5 items-center py-3 text-left text-[20px] font-semibold leading-none">
                {controlPlan.map((item) => {
                  const selected = selectedReference === item.reference;
                  const blank = quotaBlank(item.nominal, item.lower, item.upper);
                  const tone = quotaTone(item.nominal, item.lower, item.upper, lastValues[item.reference] ?? null, selected);
                  const frequency = blank ? "" : item.every > 0 ? `${item.every} ${t("operations.prediction.pcs")}` : item.callout;
                  return (
                  <button key={item.reference} type="button" onClick={() => { if (readOnly) return; setSelectedReference(item.reference); setSinceCheck(String(item.every)); }} style={{ color: tone, borderColor: tone, backgroundColor: selected ? "rgba(60,240,255,0.15)" : "transparent", width: "var(--letter-window)" }} className={`flex h-[38px] w-[var(--letter-window)] items-center rounded-md border border-white/20 bg-transparent px-2 text-left text-[20px] font-semibold leading-none transition hover:bg-white/[0.04] ${readOnly ? "pointer-events-none" : ""}`}>
                    <span className="whitespace-pre">{`${item.reference}  ➜`}</span>
                    {frequency ? <span className="ml-2 whitespace-nowrap">{frequency}</span> : null}
                  </button>
                  );
                })}
              </div>
            </div>
          </section>
          <section className={`${card} !justify-stretch !p-0`} style={{ minHeight: 480 }}>
            {mode === "manual" ? (
              <div className="flex h-full min-h-[480px] w-full flex-col px-3 pb-3 pt-3">
                <label className="flex flex-col">
                  <span className={cardTitle}>{t("operations.measured")}</span>
                  <input value={measured} readOnly={readOnly} onChange={(event) => { if (readOnly) return; setMeasured(event.target.value); }} inputMode="decimal" className="mt-[25px] h-[184px] w-full rounded-lg border border-[#232830] bg-[#040b16] px-3 text-center text-[65px] font-semibold tracking-tight text-white outline-none" />
                </label>
                <button type="button" onClick={recordMeasurement} disabled={readOnly || mode !== "manual" || !selectedReference || !valueReady} className={`${cardTitle} mt-3 h-12 w-full rounded-lg bg-[#163F56] px-2 !text-[#F4F7F8] hover:bg-[#1B465E] disabled:opacity-40`}>{t("operations.saveMeasurement")}</button>
              </div>
            ) : (
              <p className={`${stateText} m-auto`}>{t("operations.waiting")}</p>
            )}
          </section>
          <section className={`${card} !flex-row items-stretch overflow-hidden !border-2 !p-0`} style={{ minHeight: 480 }}>
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
          <section className={`${card} col-span-3 gap-2.5 !justify-between`} style={{ minHeight: 241 }}>
            <p className={cardTitle}>{t("operations.gauge")}</p>
            <p className={`${primary} !text-[38px]`} style={{ color: tone }}>{gauge.score}</p>
            <p className={`${stateText} !text-[21px] !leading-none`} style={{ color: tone }}>{level}</p>
            <GaugeLegend />
            <p className={`${stateText} !text-[21px] !leading-none text-white`}>{t(diagnosis)}</p>
            <p className={`${secondary} !text-[21px] !leading-none`}>{`${t("operations.drift")} ${gauge.drift} · ${t("operations.variability")} ${gauge.variability}`}</p>
          </section>
          <section className={`${card} col-span-3 gap-2.5 !justify-between`} style={{ minHeight: 241 }}>
            <p className={cardTitle}>{t("operations.activeTool")}</p>
            <p className={`${primary} !text-[38px]`} style={{ color: life > 20 ? "#00E676" : "#FF9800" }}>{life}%</p>
            <p className={`${stateText} !text-[21px] !leading-none text-white`}>{job.tool}</p>
            <p className={`${secondary} !text-[21px] !leading-none`}>{t("operations.remainingLife")}</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={() => { if (readOnly) return; replaceTool(); setSelectedTool("wear"); }} className={`${actionButton} !min-h-[50px] !text-[19px] font-medium uppercase ${readOnly ? "pointer-events-none" : ""} ${selectedTool === "wear" ? planButtonOn : ""}`}>{t("operations.wear")}</button>
              <button type="button" onClick={() => { if (readOnly) return; replaceTool(); setSelectedTool("breakage"); }} className={`${actionButton} !min-h-[50px] !text-[19px] font-medium uppercase ${readOnly ? "pointer-events-none" : ""} ${selectedTool === "breakage" ? planButtonOn : ""}`}>{t("operations.breakage")}</button>
            </div>
            {toolNote ? <p className={`${secondary} mt-1 !text-[13px] text-[#00E676]`}>{toolNote}</p> : null}
          </section>
          <section className={`${card} col-span-2`} style={{ minHeight: 241 }}>
            <p className={cardTitle}>{t("operations.recommended")}</p>
            <p className={`${primary} mt-2.5`}>{t(action.action)}</p>
            <p className={`${stateText} mt-2.5 text-white`}>{`${t("operations.confidence")} ${action.confidence}%`}</p>
            <div className="mt-auto flex w-full flex-col gap-2 pt-3">
              <button type="button" onClick={() => setDrawingOpen(true)} className={`${stateText} text-[#3CF0FF]`}>{t("operations.openDrawing")}</button>
            </div>
          </section>
        </div>
        {drawingOpen ? (
          <div className="fixed inset-0 z-[80] flex flex-col gap-3 bg-[#040b16] p-4">
            <div className="flex items-center justify-between">
              <p className={title}>{t("operations.drawing")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDrawingZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))} className={`${touch} text-white`}>{t("operations.zoomOut")}</button>
                <button type="button" onClick={() => setDrawingZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))} className={`${touch} text-white`}>{t("operations.zoomIn")}</button>
                <button type="button" onClick={() => setDrawingOpen(false)} className={`${touch} bg-[#3CF0FF] text-[#041018]`}>{t("operations.return")}</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto" style={{ transform: `scale(${drawingZoom})` }}>
              <MarkerBoard
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
            <p className={`mx-auto rounded-lg border-2 border-[#3CF0FF] px-4 py-2 text-center text-[#3CF0FF] ${primary}`}>{`A • ${controlPlan[0]?.callout ?? ""}`}</p>
          </div>
        ) : null}
      </div>
    </div>
    </div>
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

