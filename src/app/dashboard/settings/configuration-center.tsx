"use client";

import { useEffect, useState, type ReactNode } from "react";
import { InfoTip } from "@/app/dashboard/info-tip";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { t } from "@/lib/i18n";
import { defaultGlobalConfiguration, defaultOperationalConfiguration, loadGlobalConfiguration, loadOperationalConfigurations, normalizeControls, pairKey, saveGlobalConfiguration, saveOperationalConfigurations, type ControlRow, type GlobalConfiguration, type OperationalConfiguration } from "@/lib/ppi-configuration";
import { updateQualityThresholds } from "@/server/quality-threshold-actions";

const sectionTitle = "text-[12px] font-medium uppercase tracking-[0.16em] text-slate-400";
const cardShell = "relative flex min-h-[148px] flex-col justify-between rounded-xl border border-white/10 bg-[#050d18] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const cardLabel = "text-[12px] font-medium uppercase leading-tight tracking-[0.12em] text-slate-400";
const valueField = "w-full bg-transparent text-center text-[30px] font-semibold leading-none tracking-tight text-white outline-none";
const unit = "text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500";
const actionButton = "rounded-lg border border-white/20 bg-transparent px-3 text-center text-[13px] font-medium uppercase tracking-[0.12em] text-white transition hover:!border-[#3CF0FF] hover:bg-white/[0.06] hover:shadow-[0_0_12px_rgba(60,240,255,0.28)]";
const actionOn = "!border-[#3CF0FF] !bg-[#3CF0FF]/15 shadow-[0_0_12px_rgba(60,240,255,0.22)]";

export function ConfigurationCenter({
  defaults,
  machines,
  orders,
  tools,
}: {
  defaults: { target: string; warningDelta: string; criticalDelta: string };
  machines: { id: string; name: string }[];
  orders: { id: string; label: string; machineId: string }[];
  tools: { id: string; name: string }[];
}) {
  const initialMachine = machines.find((item) => item.name === "MILL-03") ?? machines[0];
  const ordersFor = (id: string) => orders.filter((item) => item.machineId === id);
  const initialOrders = ordersFor(initialMachine?.id ?? "");
  const initialOrder = initialOrders.find((item) => item.label === "C8DK68") ?? initialOrders[0];
  const [global, setGlobal] = useState<GlobalConfiguration>(defaultGlobalConfiguration);
  const [pairs, setPairs] = useState<Record<string, OperationalConfiguration>>({});
  const [machineId, setMachineId] = useState(initialMachine?.id ?? "");
  const [orderId, setOrderId] = useState(initialOrder?.id ?? "");
  const [menu, setMenu] = useState<"machine" | "order" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [drawingFile, setDrawingFile] = useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const visibleOrders = ordersFor(machineId);
  const selectedKey = pairKey(machineId, orderId);
  const operation = pairs[selectedKey] ?? defaultOperationalConfiguration(machineId, orderId, machines.find((item) => item.id === machineId)?.name ?? "", orders.find((item) => item.id === orderId)?.label ?? "");

  useEffect(() => {
    const stored = loadGlobalConfiguration();
    setGlobal({
      ...stored,
      qualityTarget: Number(defaults.target),
      qualityAttention: Number(defaults.warningDelta),
      qualityCritical: Number(defaults.criticalDelta),
    });
    setPairs(loadOperationalConfigurations());
  }, [defaults.target, defaults.warningDelta, defaults.criticalDelta]);

  function patchGlobal(partial: Partial<GlobalConfiguration>) {
    setGlobal((current) => ({ ...current, ...partial }));
    setNotice(null);
  }

  function patchOperation(partial: Partial<OperationalConfiguration>) {
    const machine = machines.find((item) => item.id === machineId);
    const order = orders.find((item) => item.id === orderId);
    setPairs((current) => ({
      ...current,
      [selectedKey]: {
        ...(current[selectedKey] ?? defaultOperationalConfiguration(machineId, orderId, machine?.name ?? "", order?.label ?? "")),
        ...partial,
        machineId,
        orderId,
        machineName: machine?.name ?? "",
        orderLabel: order?.label ?? "",
      },
    }));
    setNotice(null);
  }

  async function save() {
    setPending(true);
    const next = global;
    const form = new FormData();
    form.set("defaultQualityTarget", String(next.qualityTarget));
    form.set("defaultWarningDelta", String(next.qualityAttention));
    form.set("defaultCriticalDelta", String(next.qualityCritical));
    const result = await updateQualityThresholds(null, form);
    if (result && result !== "settings.saved") {
      setNotice(result);
      setPending(false);
      return;
    }
    saveGlobalConfiguration(next);
    const machine = machines.find((item) => item.id === machineId);
    const order = orders.find((item) => item.id === orderId);
    const storedPairs = {
      ...pairs,
      [selectedKey]: { ...operation, controls: normalizeControls(operation.controls), machineId, orderId, machineName: machine?.name ?? "", orderLabel: order?.label ?? "" },
    };
    saveOperationalConfigurations(storedPairs);
    setPairs(storedPairs);
    setGlobal(next);
    setNotice("config.saved");
    setPending(false);
  }

  async function restore() {
    setPending(true);
    const form = new FormData();
    form.set("defaultQualityTarget", String(defaultGlobalConfiguration.qualityTarget));
    form.set("defaultWarningDelta", String(defaultGlobalConfiguration.qualityAttention));
    form.set("defaultCriticalDelta", String(defaultGlobalConfiguration.qualityCritical));
    const result = await updateQualityThresholds(null, form);
    if (result && result !== "settings.saved") {
      setNotice(result);
      setPending(false);
      return;
    }
    saveGlobalConfiguration(defaultGlobalConfiguration);
    const machine = machines.find((item) => item.id === machineId);
    const order = orders.find((item) => item.id === orderId);
    const restored = defaultOperationalConfiguration(machineId, orderId, machine?.name ?? "", order?.label ?? "");
    const storedPairs = { ...pairs, [selectedKey]: restored };
    saveOperationalConfigurations(storedPairs);
    setPairs(storedPairs);
    setGlobal(defaultGlobalConfiguration);
    setNotice("config.saved");
    setPending(false);
  }

  function updateControl(index: number, partial: Partial<ControlRow>) {
    patchOperation({ controls: operation.controls.map((row, rowIndex) => rowIndex === index ? { ...row, ...partial } : row) });
  }

  function moveControl(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= operation.controls.length) return;
    const next = [...operation.controls];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    patchOperation({ controls: normalizeControls(next) });
  }

  function addControl() {
    if (operation.controls.length >= 5) return;
    const index = operation.controls.length;
    patchOperation({ controls: normalizeControls([...operation.controls, defaultOperationalConfiguration().controls[index]]) });
  }

  function removeControl(index: number) {
    patchOperation({ controls: normalizeControls(operation.controls.filter((_, rowIndex) => rowIndex !== index)) });
  }

  function uploadDrawing(file: File | undefined, kind: "image" | "pdf") {
    if (!file) return;
    if (drawingFile) URL.revokeObjectURL(drawingFile.url);
    setDrawingFile({ url: URL.createObjectURL(file), kind });
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4 font-sans">
      <header>
        <h2 className="text-[26px] font-medium uppercase tracking-[0.08em] text-white">{t("config.title")}</h2>
        <p className="mt-2 text-[13px] text-slate-400">{t("config.subtitle")}</p>
      </header>

      <section className="grid gap-3 min-[900px]:grid-cols-2">
        <ContextMenu
          label={t("config.machine")}
          value={machines.find((item) => item.id === machineId)?.name ?? ""}
          open={menu === "machine"}
          empty={t("config.emptyMachines")}
          options={machines.map((item) => ({ id: item.id, label: item.name }))}
          onToggle={() => setMenu(menu === "machine" ? null : "machine")}
          onSelect={(id) => {
            const next = ordersFor(id);
            setMachineId(id);
            setDrawingFile(null);
            setMenu(null);
            if (!next.some((item) => item.id === orderId)) setOrderId(next[0]?.id ?? "");
          }}
        />
        <ContextMenu
          label={t("config.order")}
          value={visibleOrders.find((item) => item.id === orderId)?.label ?? ""}
          open={menu === "order"}
          empty={t("config.emptyOrders")}
          options={visibleOrders.map((item) => ({ id: item.id, label: item.label }))}
          onToggle={() => setMenu(menu === "order" ? null : "order")}
          onSelect={(id) => { setOrderId(id); setDrawingFile(null); setMenu(null); }}
        />
      </section>

      <h3 className="text-[20px] font-medium uppercase tracking-[0.08em] text-white">{t("config.global")}</h3>
      <Section title={t("config.quality")}>
        <ValueCard label={t("config.quality.target")} help={t("config.quality.target.help")} value={global.qualityTarget} suffix="%" onChange={(value) => patchGlobal({ qualityTarget: value })} />
        <ValueCard label={t("config.quality.attention")} help={t("config.quality.attention.help")} value={global.qualityAttention} suffix="%" onChange={(value) => patchGlobal({ qualityAttention: value })} />
        <ValueCard label={t("config.quality.critical")} help={t("config.quality.critical.help")} value={global.qualityCritical} suffix="%" onChange={(value) => patchGlobal({ qualityCritical: value })} />
      </Section>

      <Section title={t("config.gauge")}>
        <ValueCard label={t("config.gauge.stable")} help={t("config.gauge.stable.help")} value={global.gaugeStable} onChange={(value) => patchGlobal({ gaugeStable: value })} />
        <ValueCard label={t("config.gauge.attention")} help={t("config.gauge.attention.help")} value={global.gaugeAttention} onChange={(value) => patchGlobal({ gaugeAttention: value })} />
        <ValueCard label={t("config.gauge.critical")} help={t("config.gauge.critical.help")} value={global.gaugeCritical} onChange={(value) => patchGlobal({ gaugeCritical: value })} />
        <ValueCard label={t("config.gauge.drift")} help={t("config.gauge.drift.help")} value={global.driftWeight} suffix="%" onChange={(value) => patchGlobal({ driftWeight: value })} />
        <ValueCard label={t("config.gauge.variability")} help={t("config.gauge.variability.help")} value={global.variabilityWeight} suffix="%" onChange={(value) => patchGlobal({ variabilityWeight: value })} />
      </Section>

      <Section title={t("config.prediction")}>
        <ValueCard label={t("config.prediction.min")} help={t("config.prediction.min.help")} value={global.predictionMin} suffix={t("config.unit.pieces")} onChange={(value) => patchGlobal({ predictionMin: value })} />
        <ValueCard label={t("config.prediction.max")} help={t("config.prediction.max.help")} value={global.predictionMax} suffix={t("config.unit.pieces")} onChange={(value) => patchGlobal({ predictionMax: value })} />
        <ValueCard label={t("config.prediction.confidence")} help={t("config.prediction.confidence.help")} value={global.predictionConfidence} suffix="%" onChange={(value) => patchGlobal({ predictionConfidence: value })} />
      </Section>

      <Section title={t("config.recommendation")}>
        <ValueCard label={t("config.recommendation.stop")} help={t("config.recommendation.stop.help")} value={global.stopThreshold} hint={t("config.recommendation.threshold")} onChange={(value) => patchGlobal({ stopThreshold: value })} />
        <ValueCard label={t("config.recommendation.extra")} help={t("config.recommendation.extra.help")} value={global.extraThreshold} hint={t("config.recommendation.threshold")} onChange={(value) => patchGlobal({ extraThreshold: value })} />
        <ValueCard label={t("config.recommendation.replace")} help={t("config.recommendation.replace.help")} value={global.replaceThreshold} hint={t("config.recommendation.threshold")} onChange={(value) => patchGlobal({ replaceThreshold: value })} />
      </Section>

      <Section title={t("config.tool")}>
        <ValueCard label={t("config.tool.wear")} help={t("config.tool.wear.help")} value={global.wearWeight} suffix="%" onChange={(value) => patchGlobal({ wearWeight: value })} />
        <ValueCard label={t("config.tool.drift")} help={t("config.tool.drift.help")} value={global.toolDriftWeight} suffix="%" onChange={(value) => patchGlobal({ toolDriftWeight: value })} />
        <ValueCard label={t("config.tool.variability")} help={t("config.tool.variability.help")} value={global.toolVariabilityWeight} suffix="%" onChange={(value) => patchGlobal({ toolVariabilityWeight: value })} />
        <ValueCard label={t("config.tool.breakage")} help={t("config.tool.breakage.help")} value={global.breakageWeight} suffix="%" onChange={(value) => patchGlobal({ breakageWeight: value })} />
      </Section>

      <Section title={t("config.learning")}>
        <ValueCard label={t("config.learning.experience")} help={t("config.learning.experience.help")} value={global.learningExperience} suffix="%" onChange={(value) => patchGlobal({ learningExperience: value })} />
        <ValueCard label={t("config.learning.memory")} help={t("config.learning.memory.help")} value={global.learningMemory} onChange={(value) => patchGlobal({ learningMemory: value })} />
        <ValueCard label={t("config.learning.cases")} help={t("config.learning.cases.help")} value={global.learningCases} onChange={(value) => patchGlobal({ learningCases: value })} />
      </Section>

      <h3 className="text-[20px] font-medium uppercase tracking-[0.08em] text-white">{t("config.operational")}</h3>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>{t("config.plan")}</h3>
        <div className="grid gap-3">
          {operation.controls.map((row, index) => (
            <article key={row.reference} className="relative grid items-center gap-3 rounded-xl border border-white/10 bg-[#050d18] px-4 pb-3 pt-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] min-[1100px]:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,0.8fr)_auto]">
              <InfoTip title={`${t("config.plan")} ${row.reference}`} text={t("config.plan.help")} />
              <p className="text-center text-[30px] font-semibold leading-none text-[#3CF0FF]">{row.reference}</p>
              <input aria-label={t("config.plan.tolerance")} value={row.callout} onChange={(event) => updateControl(index, { callout: event.target.value })} className="h-12 rounded-lg border border-white/15 bg-[#040b16] px-3 text-center text-[20px] font-medium text-white outline-none" />
              <label className="flex items-center justify-center gap-2 text-[13px] uppercase tracking-[0.08em] text-slate-400">
                {t("config.plan.every")}
                <input aria-label={t("config.plan.frequency")} value={String(row.every)} inputMode="numeric" onChange={(event) => updateControl(index, { every: Number(event.target.value.replace(",", ".")) })} className="h-12 w-20 rounded-lg border border-white/15 bg-[#040b16] text-center text-[20px] font-semibold text-white outline-none" />
                {t("config.plan.pieces")}
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => moveControl(index, -1)} className={`${actionButton} min-h-10`}>{t("config.plan.up")}</button>
                <button type="button" onClick={() => moveControl(index, 1)} className={`${actionButton} min-h-10`}>{t("config.plan.down")}</button>
                <button type="button" onClick={() => removeControl(index)} className={`${actionButton} min-h-10`}>{t("config.plan.remove")}</button>
              </div>
            </article>
          ))}
        </div>
        {operation.controls.length < 5 ? <button type="button" onClick={addControl} className={`${actionButton} min-h-12 w-full`}>{t("config.plan.add")}</button> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>{t("config.drawing")}</h3>
        <div className="relative">
          <InfoTip title={t("config.drawing")} text={t("config.drawing.help")} />
          <MarkerBoard markers={operation.markers} onChange={(markers) => patchOperation({ markers })} drawing={drawingFile} onFile={(file) => uploadDrawing(file, file.type === "application/pdf" ? "pdf" : "image")} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>{t("config.toolAssignment")}</h3>
        <div className="relative flex flex-wrap gap-2 pt-6">
          <InfoTip title={t("config.toolAssignment")} text={t("config.toolAssignment.help")} />
          <button type="button" onClick={() => patchOperation({ toolId: "" })} className={`${actionButton} min-h-12 ${operation.toolId === "" ? actionOn : ""}`}>{t("config.tool.none")}</button>
          {tools.map((tool) => (
            <button key={tool.id} type="button" onClick={() => patchOperation({ toolId: tool.id })} className={`${actionButton} min-h-12 ${operation.toolId === tool.id ? actionOn : ""}`}>{tool.name}</button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>{t("config.acquisition")}</h3>
        <div className="relative grid grid-cols-3 gap-3 pt-6">
          <InfoTip title={t("config.acquisition")} text={t("config.acquisition.help")} />
          {(["manual", "usb", "bluetooth"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => patchOperation({ acquisition: mode })} className={`${actionButton} min-h-14 ${operation.acquisition === mode ? actionOn : ""}`}>{t(`operations.${mode}`)}</button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>{t("config.operator")}</h3>
        <div className="grid gap-3 min-[1100px]:grid-cols-3">
          <ToggleCard label={t("config.operator.sound")} help={t("config.operator.sound.help")} on={operation.sound} onChange={(sound) => patchOperation({ sound })} />
          <ToggleCard label={t("config.operator.drawing")} help={t("config.operator.drawing.help")} on={operation.showDrawing} onChange={(showDrawing) => patchOperation({ showDrawing })} />
          <ToggleCard label={t("config.operator.confirm")} help={t("config.operator.confirm.help")} on={operation.autoConfirm} onChange={(autoConfirm) => patchOperation({ autoConfirm })} />
        </div>
        <p className="text-[12px] leading-5 text-slate-500">
          <span className="font-medium uppercase tracking-[0.12em] text-slate-400">{t("config.voice")}. </span>
          {t("config.voice.note")}
        </p>
      </section>

      {notice ? <p className="text-center text-[13px] text-[#00E676]">{t(notice)}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={save} className="min-h-14 rounded-lg bg-[#163F56] px-6 text-[14px] font-medium uppercase tracking-[0.12em] text-[#F4F7F8] hover:bg-[#1B465E] disabled:opacity-40">{t("config.save")}</button>
        <button type="button" disabled={pending} onClick={restore} className={`${actionButton} min-h-14 px-6`}>{t("config.restore")}</button>
      </div>
    </div>
  );
}

function ContextMenu({
  label,
  value,
  open,
  empty,
  options,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  open: boolean;
  empty: string;
  options: { id: string; label: string }[];
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={`relative ${open ? "z-30" : ""}`}>
      <p className={cardLabel}>{label}</p>
      <button type="button" onClick={onToggle} className={`${actionButton} mt-2 flex h-12 w-full items-center justify-between px-4`}>
        <span>{value || empty}</span>
        <span aria-hidden="true">â–¼</span>
      </button>
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/15 bg-[#050d18] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          {options.length === 0 ? <li className="px-4 py-2 text-[13px] text-slate-400">{empty}</li> : options.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} className="w-full px-4 py-2 text-left text-[13px] font-medium uppercase tracking-[0.12em] text-white hover:bg-[#3CF0FF]/15">{item.label}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={sectionTitle}>{title}</h3>
      <div className="grid gap-3 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-5">{children}</div>
    </section>
  );
}

function ValueCard({ label, help, value, suffix, hint, onChange }: { label: string; help: string; value: number; suffix?: string; hint?: string; onChange: (value: number) => void }) {
  return (
    <article className={cardShell}>
      <InfoTip title={label} text={help} />
      <p className={cardLabel}>{label}</p>
      <input value={Number.isFinite(value) ? String(value) : ""} inputMode="decimal" onChange={(event) => onChange(Number(event.target.value.replace(",", ".")))} className={valueField} />
      <p className={unit}>{hint ?? suffix ?? " "}</p>
    </article>
  );
}

function ToggleCard({ label, help, on, onChange }: { label: string; help: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <article className={cardShell}>
      <InfoTip title={label} text={help} />
      <p className={cardLabel}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange(true)} className={`${actionButton} min-h-12 ${on ? actionOn : ""}`}>{t("config.operator.on")}</button>
        <button type="button" onClick={() => onChange(false)} className={`${actionButton} min-h-12 ${on ? "" : actionOn}`}>{t("config.operator.off")}</button>
      </div>
      <p className={unit}> </p>
    </article>
  );
}

