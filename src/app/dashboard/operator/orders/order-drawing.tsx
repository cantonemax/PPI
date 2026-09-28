"use client";

import { useState } from "react";
import { MarkerBoard } from "@/app/dashboard/marker-board";
import { t } from "@/lib/i18n";
import { type DrawingMarker } from "@/lib/drawing-references";

export function OperatorDrawing({
  drawing,
  markers,
}: {
  drawing: { url: string; kind: "image" | "pdf" } | null;
  markers: DrawingMarker[];
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div>
      <div className="mb-2 flex justify-end gap-2">
        <button type="button" onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))} className="rounded-full border border-white/20 px-3 py-1 text-[13px]">{t("operations.zoomOut")}</button>
        <button type="button" onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))} className="rounded-full border border-white/20 px-3 py-1 text-[13px]">{t("operations.zoomIn")}</button>
      </div>
      <div className="origin-top" style={{ transform: `scale(${zoom})` }}>
        <MarkerBoard locked markers={markers} drawing={drawing} onChange={() => undefined} emptyText={t("drawing.empty")} />
      </div>
    </div>
  );
}
