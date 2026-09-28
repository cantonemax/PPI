"use client";

import { useState } from "react";
import { DecimalField } from "@/app/dashboard/decimal-field";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { t } from "@/lib/i18n";
import { blankSpecification, familyTemplate, partFamilies, type ArticleSpecification, type PartFamily } from "@/lib/part-families";
import { type DrawingReference } from "@/lib/drawing-references";
import { decimalNumber } from "@/lib/decimal-input";
import { toleranceKinds } from "@/lib/tolerance";
import { toolFamilies } from "@/lib/tool-families";
import { createToolQuick } from "@/server/resource-actions";

export function specificationsFor(family: PartFamily): ArticleSpecification[] {
  const template = familyTemplate(family);
  if (!template) return blankSpecification();
  return template.map((row) => ({
    reference: row.reference,
    dimensionName: t(row.nameKey),
    nominal: row.nominal,
    tolerance: row.tolerance,
    toleranceKind: "symmetric" as const,
    upperDeviation: row.tolerance,
    lowerDeviation: -row.tolerance,
    frequency: row.frequency,
    x: row.x,
    y: row.y,
    enabled: true,
  }));
}

export function ArticleSpecEditor({
  family,
  onFamily,
  rows,
  onRows,
  onFile,
  tools,
  toolIds,
  onTools,
  onToolCreated,
}: {
  family: PartFamily;
  onFamily: (family: PartFamily) => void;
  rows: ArticleSpecification[];
  onRows: (rows: ArticleSpecification[]) => void;
  onFile: (file: File | null, url: string | null) => void;
  tools: { id: string; name: string }[];
  toolIds: string[];
  onTools: (ids: string[]) => void;
  onToolCreated: (tool: { id: string; name: string }) => void;
}) {
  const [drawing, setDrawing] = useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const [newTool, setNewTool] = useState(false);
  const [toolCode, setToolCode] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolFamily, setToolFamily] = useState("drill");
  const [manufacturer, setManufacturer] = useState("");
  const [notes, setNotes] = useState("");

  function patch(reference: DrawingReference, next: Partial<ArticleSpecification>) {
    onRows(rows.map((row) => row.reference === reference ? { ...row, ...next, enabled: true } : row));
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm">{t("part.family")}
        <select value={family} onChange={(event) => {
          const next = event.target.value as PartFamily;
          onFamily(next);
          onRows(specificationsFor(next));
        }} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2">
          {partFamilies.map((item) => <option key={item} value={item}>{t(`part.family.${item}`)}</option>)}
        </select>
      </label>
      <p className="text-sm text-stone-600">{t("part.suggestion")}</p>
      <MarkerBoard
        markers={rows.map((row) => ({ reference: row.reference, x: row.x, y: row.y }))}
        onChange={(markers) => onRows(rows.map((row) => {
          const marker = markers.find((item) => item.reference === row.reference);
          return marker ? { ...row, x: marker.x, y: marker.y, enabled: true } : row;
        }))}
        drawing={family === "special" ? drawing : null}
        onFile={family === "special" ? (file) => {
          if (drawing) URL.revokeObjectURL(drawing.url);
          const url = URL.createObjectURL(file);
          setDrawing({ url, kind: file.type === "application/pdf" ? "pdf" : "image" });
          onFile(file, url);
        } : undefined}
      />
      <label className="text-sm">{t("order.tool")}
        <select value={newTool ? "new" : toolIds[0] ?? ""} onChange={(event) => {
          if (event.target.value === "new") { setNewTool(true); return; }
          setNewTool(false);
          onTools(event.target.value ? [event.target.value] : []);
        }} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2">
          <option value="new">{t("tool.new")}</option>
          <option value="">{t("order.none")}</option>
          {tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}
        </select>
      </label>
      {newTool ? (
        <div className="grid gap-2 border border-stone-200 p-3">
          <input value={toolCode} onChange={(event) => setToolCode(event.target.value)} placeholder={t("tool.code")} className="border border-stone-300 bg-white px-2 py-1" />
          <input value={toolDescription} onChange={(event) => setToolDescription(event.target.value)} placeholder={t("tool.description")} className="border border-stone-300 bg-white px-2 py-1" />
          <select value={toolFamily} onChange={(event) => setToolFamily(event.target.value)} className="border border-stone-300 bg-white px-2 py-1">
            {toolFamilies.map((item) => <option key={item} value={item}>{t(`tool.family.${item}`)}</option>)}
          </select>
          <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder={t("tool.manufacturer")} className="border border-stone-300 bg-white px-2 py-1" />
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("tool.notes")} className="border border-stone-300 bg-white px-2 py-1" />
          <button type="button" onClick={async () => {
            const formData = new FormData();
            formData.set("code", toolCode);
            formData.set("description", toolDescription);
            formData.set("toolFamily", toolFamily);
            formData.set("manufacturer", manufacturer);
            formData.set("notes", notes);
            const result = await createToolQuick(formData);
            if ("error" in result) return;
            onToolCreated(result);
            onTools([result.id]);
            setNewTool(false);
          }} className="border border-stone-900 px-3 py-2 text-sm">{t("tool.save")}</button>
        </div>
      ) : null}
      <div className="grid grid-cols-[auto_1fr_5rem_5rem_5rem] gap-2 text-sm">
        <span />
        <span>{t("part.dimensions")}</span>
        <span>{t("part.nominal")}</span>
        <span>{t("part.tolerance")}</span>
        <span>{t("part.frequency")}</span>
        {rows.map((row) => (
          <div key={row.reference} className="col-span-5 grid grid-cols-subgrid items-center gap-2">
            <span>{row.reference}</span>
            <input value={row.dimensionName} onChange={(event) => patch(row.reference, { dimensionName: event.target.value })} className="border border-stone-300 bg-white px-2 py-1" />
            <DecimalField value={String(row.nominal)} onValue={(nominal) => { if (!/^-?\d+(\.\d+)?$/.test(nominal)) return; patch(row.reference, { nominal: decimalNumber(nominal) }); }} />
            <span className="flex flex-col gap-1">
              <select value={row.toleranceKind} onChange={(event) => patch(row.reference, { toleranceKind: event.target.value as ArticleSpecification["toleranceKind"] })} className="border border-stone-300 bg-white px-1 py-1">
                {toleranceKinds.map((kind) => <option key={kind} value={kind}>{t(`tolerance.kind.${kind}`)}</option>)}
              </select>
              {row.toleranceKind === "symmetric" ? <DecimalField value={String(row.tolerance)} onValue={(tolerance) => { if (!/^-?\d+(\.\d+)?$/.test(tolerance)) return; patch(row.reference, { tolerance: Math.abs(decimalNumber(tolerance)) }); }} /> : null}
              {row.toleranceKind === "bilateral" || row.toleranceKind === "custom" ? (
                <>
                  <DecimalField value={String(row.upperDeviation)} placeholder={t("tolerance.upper")} onValue={(upperDeviation) => { if (!/^-?\d+(\.\d+)?$/.test(upperDeviation)) return; patch(row.reference, { upperDeviation: decimalNumber(upperDeviation) }); }} />
                  <DecimalField value={String(row.lowerDeviation)} placeholder={t("tolerance.lower")} onValue={(lowerDeviation) => { if (!/^-?\d+(\.\d+)?$/.test(lowerDeviation)) return; patch(row.reference, { lowerDeviation: decimalNumber(lowerDeviation) }); }} />
                </>
              ) : null}
            </span>
            <input value={row.frequency} onChange={(event) => patch(row.reference, { frequency: Number(event.target.value) })} className="border border-stone-300 bg-white px-2 py-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
