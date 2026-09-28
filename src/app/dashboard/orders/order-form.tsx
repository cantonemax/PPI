"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DecimalField } from "@/app/dashboard/decimal-field";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { specificationsFor } from "@/app/dashboard/parts/article-spec-editor";
import { t } from "@/lib/i18n";
import { type DrawingMarker } from "@/lib/drawing-references";
import { controlsFromSnapshot, type OrderControlRow } from "@/lib/order-controls";
import { isPartFamily, partFamilies, type PartFamily } from "@/lib/part-families";
import { toleranceKinds, type ToleranceKind } from "@/lib/tolerance";
import { createPartQuick } from "@/server/part-actions";

const field = "mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-[13px] text-slate-100 outline-none [color-scheme:dark]";
const cell = "rounded-lg border border-white/15 bg-[#0b1830] px-2 py-1 text-[13px] text-slate-100 outline-none [color-scheme:dark]";

type PartOption = { id: string; name: string; family: string; controls: OrderControlRow[] };

function rowsForFamily(family: PartFamily): OrderControlRow[] {
  return controlsFromSnapshot(specificationsFor(family).map((row) => ({
    name: `${row.reference} ${row.dimensionName}`,
    nominal: { toString: () => String(row.nominal) },
    toleranceKind: row.toleranceKind,
    upperDeviation: { toString: () => String(row.tolerance) },
    lowerDeviation: { toString: () => String(-Math.abs(row.tolerance)) },
    lowerLimit: { toString: () => String(row.nominal) },
    upperLimit: { toString: () => String(row.nominal) },
    frequency: row.frequency,
    markerX: { toString: () => String(row.x) },
    markerY: { toString: () => String(row.y) },
  })));
}

export function OrderForm({
  action,
  parts,
}: {
  action: (state: string | null, formData: FormData) => Promise<string | null>;
  parts: PartOption[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [partOptions, setPartOptions] = useState(parts);
  const [partId, setPartId] = useState("");
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState<PartFamily>("bolt");
  const [partError, setPartError] = useState<string | null>(null);
  const [savingPart, setSavingPart] = useState(false);
  const [controls, setControls] = useState<OrderControlRow[]>(() => controlsFromSnapshot([]));
  const [drawingView, setDrawingView] = useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = partOptions.find((part) => part.id === partId);
  const storedFamily = isPartFamily(selected?.family ?? "") ? selected?.family : "";

  useEffect(() => {
    if (selected) setControls(selected.controls);
  }, [selected]);

  function patchControl(reference: string, next: Partial<OrderControlRow>) {
    setControls((rows) => rows.map((row) => row.reference === reference ? { ...row, ...next } : row));
  }

  function onMarkers(markers: DrawingMarker[]) {
    setControls((rows) => rows.map((row) => {
      const marker = markers.find((item) => item.reference === row.reference);
      return marker ? { ...row, x: marker.x, y: marker.y, placed: true } : { ...row, placed: false };
    }));
  }

  async function savePart() {
    setSavingPart(true);
    setPartError(null);
    const formData = new FormData();
    formData.set("code", code);
    formData.set("description", description);
    formData.set("partType", family);
    formData.set("dimensions", JSON.stringify(specificationsFor(family)));
    formData.set("toolIds", "[]");
    const result = await createPartQuick(formData);
    setSavingPart(false);
    if ("error" in result) {
      setPartError(result.error);
      return;
    }
    const nextControls = rowsForFamily(family).map((row) => ({ ...row, placed: false }));
    setPartOptions((current) => [...current, { id: result.id, name: result.name, family, controls: nextControls }]);
    setPartId(result.id);
    setControls(nextControls);
    setCreating(false);
    setCode("");
    setDescription("");
  }

  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-4 text-[13px] uppercase tracking-[0.08em]">
      <input type="hidden" name="partId" value={partId} />
      <input type="hidden" name="controls" value={JSON.stringify(controls)} />
      <input ref={fileRef} type="file" name="drawing" className="hidden" />
      <label>{t("order.code")}
        <input name="code" required className={field} />
      </label>
      <label>{t("order.listQuantity")}
        <input name="targetQuantity" type="number" min={1} required defaultValue={1} className={field} />
      </label>
      <label>{t("order.part")}
        <select value={creating ? "new" : partId} onChange={(event) => { if (event.target.value === "new") { setCreating(true); return; } setCreating(false); setPartId(event.target.value); }} className={field}>
          <option value="">{t("order.none")}</option>
          {partOptions.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
          <option value="new">{t("order.part.new")}</option>
        </select>
      </label>
      {creating ? (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#08141f] p-3">
          <label>{t("part.code")}
            <input value={code} onChange={(event) => setCode(event.target.value)} className={field} />
          </label>
          <label>{t("part.description")}
            <input value={description} onChange={(event) => setDescription(event.target.value)} className={field} />
          </label>
          {partError ? <p className="text-[#FF4D4F]">{t(partError)}</p> : null}
          <button type="button" disabled={savingPart} onClick={savePart} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-cyan-100 disabled:opacity-40">{t("part.save")}</button>
        </div>
      ) : null}
      <label>{t("part.family")}
        {creating ? (
          <select value={family} onChange={(event) => setFamily(event.target.value as PartFamily)} className={field}>
            {partFamilies.map((item) => <option key={item} value={item}>{t(`part.family.${item}`)}</option>)}
          </select>
        ) : (
          <input readOnly value={storedFamily ? t(`part.family.${storedFamily}`) : ""} className={field} />
        )}
      </label>
      <label>{t("order.startDate")}
        <input name="plannedStart" type="date" className={field} />
      </label>
      <label>{t("order.due")}
        <input name="plannedDelivery" type="date" className={field} />
      </label>
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] tracking-[0.16em] text-cyan-200">{t("order.drawing")}</h2>
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
            const transfer = new DataTransfer();
            transfer.items.add(file);
            if (fileRef.current) fileRef.current.files = transfer.files;
          }}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] tracking-[0.16em] text-cyan-200">{t("order.inspection")}</h2>
        <div className="grid grid-cols-[2rem_1fr_6rem_9rem_9rem_7rem] gap-2 text-cyan-300/80">
          <span />
          <span>{t("tolerance.column.description")}</span>
          <span>{t("tolerance.column.nominal")}</span>
          <span>{t("tolerance.column.type")}</span>
          <span>{t("tolerance.column.data")}</span>
          <span>{t("tolerance.column.frequency")}</span>
        </div>
        {controls.map((row) => (
            <div key={row.reference} className="grid grid-cols-[2rem_1fr_6rem_9rem_9rem_7rem] items-start gap-2">
              <span className="pt-2 text-cyan-200">{row.reference}</span>
              <input value={row.dimensionName} onChange={(event) => patchControl(row.reference, { dimensionName: event.target.value })} className={cell} />
              <DecimalField className={cell} label={t("tolerance.column.nominal")} value={row.nominal} onValue={(nominal) => patchControl(row.reference, { nominal })} />
              <select value={row.toleranceKind} onChange={(event) => patchControl(row.reference, { toleranceKind: event.target.value as ToleranceKind })} className={cell}>
                {toleranceKinds.map((kind) => <option key={kind} value={kind}>{t(`tolerance.kind.${kind}`)}</option>)}
              </select>
              <span className="flex flex-col gap-1">
                {row.toleranceKind === "symmetric" ? (
                  <>
                    <DecimalField className={cell} label={t("tolerance.value")} value={row.tolerance} placeholder={t("tolerance.value")} onValue={(tolerance) => patchControl(row.reference, { tolerance })} />
                    <span className="text-slate-400">±{row.tolerance || "0"}</span>
                  </>
                ) : null}
                {row.toleranceKind === "bilateral" || row.toleranceKind === "custom" ? (
                  <>
                    <DecimalField className={cell} label={t("tolerance.upper")} value={row.upperDeviation} placeholder={t("tolerance.upper")} onValue={(upperDeviation) => patchControl(row.reference, { upperDeviation })} />
                    <DecimalField className={cell} label={t("tolerance.lower")} value={row.lowerDeviation} placeholder={t("tolerance.lower")} onValue={(lowerDeviation) => patchControl(row.reference, { lowerDeviation })} />
                    <span className="text-slate-400">+{row.upperDeviation || "0"} / -{row.lowerDeviation.replace(/^-/, "") || "0"}</span>
                  </>
                ) : null}
              </span>
              <input value={row.frequency} inputMode="numeric" onChange={(event) => patchControl(row.reference, { frequency: Math.max(0, Math.round(Number(event.target.value) || 0)) })} className={cell} />
            </div>
        ))}
      </section>
      {state ? <p className="text-[#FF4D4F]">{t(state)}</p> : null}
      <button disabled={pending || creating} className="w-fit rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white disabled:opacity-40">{t("order.save")}</button>
    </form>
  );
}
