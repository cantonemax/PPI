"use client";

import { useActionState, useState } from "react";
import { DecimalField } from "@/app/dashboard/decimal-field";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { t } from "@/lib/i18n";
import { timeControlsPaused } from "@/lib/service-phase";
import { type DrawingMarker } from "@/lib/drawing-references";
import { type OrderControlRow } from "@/lib/order-controls";
import { toleranceKinds, type ToleranceKind } from "@/lib/tolerance";
import { toolFamilies } from "@/lib/tool-families";
import { attachOrderDrawing } from "@/server/order-actions";
import { createToolQuick, updateToolIdentity } from "@/server/resource-actions";

type ToolRow = { id: string; name: string; description: string; toolFamily: string; manufacturer: string; notes: string };
type ControlRow = OrderControlRow;

export function OrderSettingsForm({
  action,
  orderId,
  machines,
  operators,
  tools,
  defaults,
  drawing,
  canAuthorize = false,
}: {
  action: (state: string | null, formData: FormData) => Promise<string | null>;
  orderId: string;
  machines: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  tools: ToolRow[];
  defaults: {
    machineId: string;
    operatorId: string;
    targetQuantity: number;
    timePerPiece: string;
    expectedScrap: string;
    useCompanyDefaults: boolean;
    qualityTarget: string;
    warningDelta: string;
    criticalDelta: string;
    companyTarget: string;
    companyWarning: string;
    companyCritical: string;
    toolLines: { id: string; quantity: string }[];
    controls: ControlRow[];
    operatorCanEdit: boolean;
  };
  canAuthorize?: boolean;
  drawing: { url: string; kind: "image" | "pdf" } | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [useCompanyDefaults, setUseCompanyDefaults] = useState(defaults.useCompanyDefaults);
  const [controls, setControls] = useState(defaults.controls);
  const [catalog, setCatalog] = useState(tools);
  const [toolLines, setToolLines] = useState(defaults.toolLines.length ? defaults.toolLines : [{ id: "", quantity: "1" }]);
  const [drawingView, setDrawingView] = useState(drawing);
  const [toolMode, setToolMode] = useState<"assign" | "create" | "edit">("assign");
  const [editId, setEditId] = useState("");

  function patchControl(reference: string, next: Partial<ControlRow>) {
    setControls((rows) => rows.map((row) => row.reference === reference ? { ...row, ...next } : row));
  }

  function onMarkers(markers: DrawingMarker[]) {
    setControls((rows) => rows.map((row) => {
      const marker = markers.find((item) => item.reference === row.reference);
      return marker ? { ...row, x: marker.x, y: marker.y, placed: true } : { ...row, placed: false };
    }));
  }

  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-4 text-[13px] uppercase tracking-[0.08em]">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="controls" value={JSON.stringify(controls)} />
      <label className="text-sm">{t("order.machine")}
        <select name="machineId" defaultValue={defaults.machineId} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]">
          <option value="">{t("order.none")}</option>
          {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
        </select>
      </label>
      <label className="text-sm">{t("order.operator")}
        <select name="operatorId" defaultValue={defaults.operatorId} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]">
          <option value="">{t("order.none")}</option>
          {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
        </select>
      </label>
      {canAuthorize ? (
        <label className="flex items-center gap-2 text-sm">
          <input name="operatorCanEdit" type="checkbox" defaultChecked={defaults.operatorCanEdit} className="h-4 w-4 accent-[#3CF0FF]" />
          {t("order.operatorCanEdit")}
        </label>
      ) : null}
      {timeControlsPaused ? null : (
        <label className="text-sm">{t("order.cycle")}
          <input name="timePerPiece" defaultValue={defaults.timePerPiece} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
        </label>
      )}
      <fieldset className="flex flex-col gap-3 rounded-xl border border-white/10 p-3">
        <legend className="px-1 text-sm">{t("order.qualityTarget")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input name="useCompanyDefaults" type="checkbox" checked={useCompanyDefaults} onChange={(event) => setUseCompanyDefaults(event.target.checked)} />
          {t("order.useCompanyDefaults")}
        </label>
        <label className="text-sm">{t("order.qualityTarget")}
          <input name="qualityTarget" defaultValue={useCompanyDefaults ? defaults.companyTarget : defaults.qualityTarget} disabled={useCompanyDefaults} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark] disabled:opacity-40" />
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-xl border border-white/10 p-3">
        <legend className="px-1 text-sm">{t("order.gauge")}</legend>
        <p className="text-sm text-slate-400">{t("order.gauge.bands")}</p>
        <label className="text-sm">{t("order.qualityWarning")}
          <input name="warningDelta" defaultValue={useCompanyDefaults ? defaults.companyWarning : defaults.warningDelta} disabled={useCompanyDefaults} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark] disabled:opacity-40" />
        </label>
        <label className="text-sm">{t("order.qualityDelta")}
          <input name="criticalDelta" defaultValue={useCompanyDefaults ? defaults.companyCritical : defaults.criticalDelta} disabled={useCompanyDefaults} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark] disabled:opacity-40" />
        </label>
      </fieldset>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">{t("order.drawing")}</h2>
        <MarkerBoard
          markers={controls.filter((row) => row.placed).map((row) => ({ reference: row.reference as DrawingMarker["reference"], x: row.x, y: row.y }))}
          onChange={onMarkers}
          drawing={drawingView}
          emptyText={t("drawing.empty")}
          onFile={(file) => {
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            const image = ["png", "jpg", "jpeg", "webp"].includes(extension);
            const pdf = extension === "pdf";
            if (!image && !pdf) return;
            const url = URL.createObjectURL(file);
            setDrawingView({ url, kind: pdf ? "pdf" : "image" });
            const body = new FormData();
            body.set("orderId", orderId);
            body.set("file", file);
            void attachOrderDrawing(body);
          }}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t("order.inspection")}</h2>
        <div className="grid grid-cols-[2rem_1fr_6rem_9rem_9rem_7rem] gap-2 text-sm text-slate-400">
          <span />
          <span>{t("tolerance.column.description")}</span>
          <span>{t("tolerance.column.nominal")}</span>
          <span>{t("tolerance.column.type")}</span>
          <span>{t("tolerance.column.data")}</span>
          <span>{t("tolerance.column.frequency")}</span>
        </div>
        {controls.map((row) => (
            <div key={row.reference} className="grid grid-cols-[2rem_1fr_6rem_9rem_9rem_7rem] items-start gap-2 text-sm">
              <span className="pt-2">{row.reference}</span>
              <input value={row.dimensionName} onChange={(event) => patchControl(row.reference, { dimensionName: event.target.value })} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
              <DecimalField className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" label={t("tolerance.column.nominal")} value={row.nominal} onValue={(nominal) => patchControl(row.reference, { nominal })} />
              <select value={row.toleranceKind} onChange={(event) => patchControl(row.reference, { toleranceKind: event.target.value as ToleranceKind })} className="rounded-lg border border-white/15 bg-[#0b1830] px-1 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]">
                {toleranceKinds.map((kind) => <option key={kind} value={kind}>{t(`tolerance.kind.${kind}`)}</option>)}
              </select>
              <span className="flex flex-col gap-1">
                {row.toleranceKind === "symmetric" ? (
                  <>
                    <DecimalField className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" label={t("tolerance.value")} value={row.tolerance} placeholder={t("tolerance.value")} onValue={(tolerance) => patchControl(row.reference, { tolerance })} />
                    <span className="text-slate-400">±{row.tolerance || "0"}</span>
                  </>
                ) : null}
                {row.toleranceKind === "bilateral" || row.toleranceKind === "custom" ? (
                  <>
                    <DecimalField className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" label={t("tolerance.upper")} value={row.upperDeviation} placeholder={t("tolerance.upper")} onValue={(upperDeviation) => patchControl(row.reference, { upperDeviation })} />
                    <DecimalField className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" label={t("tolerance.lower")} value={row.lowerDeviation} placeholder={t("tolerance.lower")} onValue={(lowerDeviation) => patchControl(row.reference, { lowerDeviation })} />
                    <span className="text-slate-400">+{row.upperDeviation || "0"} / -{row.lowerDeviation.replace(/^-/, "") || "0"}</span>
                  </>
                ) : null}
              </span>
              <input value={row.frequency} inputMode="numeric" onChange={(event) => patchControl(row.reference, { frequency: Math.max(0, Math.round(Number(event.target.value) || 0)) })} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
            </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t("order.tool.assign")}</h2>
        {toolLines.map((line, index) => (
          <div key={`tool-${index}`} className="grid grid-cols-2 gap-2">
            <label className="text-sm">{t("order.tool")}
              <select name="toolId" value={line.id} onChange={(event) => {
                const value = event.target.value;
                if (value === "new") { setToolMode("create"); return; }
                if (value === "edit") { setEditId(line.id); setToolMode("edit"); return; }
                setToolLines((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, id: value } : item));
              }} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]">
                <option value="new">{t("tool.new")}</option>
                <option value="edit">{t("tool.edit")}</option>
                <option value="">{t("order.none")}</option>
                {catalog.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}
              </select>
            </label>
            <label className="text-sm">{t("order.quantityUsed")}
              <input name="toolQuantity" value={line.quantity} onChange={(event) => setToolLines((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
            </label>
          </div>
        ))}
        {toolMode === "create" ? <ToolIdentity mode="create" onDone={(tool) => { setCatalog((rows) => [...rows, tool]); setToolLines((rows) => rows.map((item, index) => index === 0 ? { ...item, id: tool.id } : item)); setToolMode("assign"); }} onClose={() => setToolMode("assign")} /> : null}
        {toolMode === "edit" ? <ToolIdentity mode="edit" tool={catalog.find((tool) => tool.id === editId) ?? catalog.find((tool) => tool.id === toolLines[0]?.id)} onDone={(tool) => { setCatalog((rows) => rows.map((item) => item.id === tool.id ? { ...item, ...tool } : item)); setToolMode("assign"); }} onClose={() => setToolMode("assign")} /> : null}
      </section>
      {state ? <p className="text-sm text-[#FF4D4F]">{t(state)}</p> : null}
      <button disabled={pending} className="w-fit rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white disabled:opacity-40">{t("order.save")}</button>
    </form>
  );
}

function ToolIdentity({
  mode,
  tool,
  onDone,
  onClose,
}: {
  mode: "create" | "edit";
  tool?: ToolRow;
  onDone: (tool: ToolRow) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [family, setFamily] = useState(tool?.toolFamily || "drill");
  const [manufacturer, setManufacturer] = useState(tool?.manufacturer ?? "");
  const [notes, setNotes] = useState(tool?.notes ?? "");
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 p-3">
      <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("tool.code")} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("tool.description")} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
      <select value={family} onChange={(event) => setFamily(event.target.value)} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]">
        {toolFamilies.map((item) => <option key={item} value={item}>{t(`tool.family.${item}`)}</option>)}
      </select>
      <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder={t("tool.manufacturer")} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
      <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("tool.notes")} className="rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]" />
      <div className="flex gap-2">
        <button type="button" onClick={async () => {
          const formData = new FormData();
          formData.set("code", code);
          formData.set("description", description);
          formData.set("toolFamily", family);
          formData.set("manufacturer", manufacturer);
          formData.set("notes", notes);
          if (mode === "edit" && tool) formData.set("toolId", tool.id);
          const result = mode === "edit" ? await updateToolIdentity(formData) : await createToolQuick(formData);
          if ("error" in result) return;
          onDone({ id: result.id, name: result.name, description, toolFamily: family, manufacturer, notes });
        }} className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white">{t("tool.save")}</button>
        <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-4 py-2 text-slate-200">{t("order.none")}</button>
      </div>
    </div>
  );
}

