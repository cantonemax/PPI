"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { drawingReferences, type DrawingMarker, type DrawingReference } from "@/lib/drawing-references";

export function MarkerBoard({
  markers,
  onChange,
  drawing,
  onFile,
  emptyText,
  locked = false,
}: {
  markers: DrawingMarker[];
  onChange: (markers: DrawingMarker[]) => void;
  drawing?: { url: string; kind: "image" | "pdf" } | null;
  onFile?: (file: File) => void;
  emptyText?: string;
  locked?: boolean;
}) {
  const [active, setActive] = useState<DrawingReference | null>(null);

  function choose(reference: DrawingReference) {
    if (markers.some((item) => item.reference === reference)) {
      onChange(markers.filter((item) => item.reference !== reference));
      setActive((current) => current === reference ? null : current);
      return;
    }
    setActive((current) => current === reference ? null : reference);
  }

  function move(reference: DrawingReference, x: number, y: number) {
    const next = markers.filter((item) => item.reference !== reference);
    next.push({ reference, x: clamp(x), y: clamp(y) });
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {locked ? null : (
      <div className="flex flex-wrap gap-2 rounded-xl bg-[#050d18] p-2">
        {onFile ? (
          <>
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-white/20 px-3 text-[13px] text-white">
              {t("config.drawing.pdf")}
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onFile(file); }} />
            </label>
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-white/20 px-3 text-[13px] text-white">
              {t("config.drawing.image")}
              <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onFile(file); }} />
            </label>
          </>
        ) : null}
        {drawingReferences.map((reference) => (
          <button key={reference} type="button" onClick={() => choose(reference)} className={`min-h-10 min-w-10 rounded-lg border px-2 text-[16px] font-semibold ${active === reference || markers.some((item) => item.reference === reference) ? "border-[#3CF0FF] bg-[#163F56] text-[#3CF0FF]" : "border-white/20 text-white"}`}>{reference}</button>
        ))}
      </div>
      )}
      <div
        className={`relative w-full rounded-xl border border-white/10 bg-[#050d18] ${drawing ? "" : "h-[360px]"}`}
        onClick={(event) => {
          if (locked || !active || (!drawing && emptyText)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          move(active, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
        }}
      >
        {drawing?.kind === "image" ? <img src={drawing.url} alt="" className="pointer-events-none block h-auto w-full" /> : null}
        {drawing?.kind === "pdf" ? <object data={drawing.url} type="application/pdf" className="pointer-events-none block h-[720px] w-full" /> : null}
        {!drawing && emptyText ? <p className="grid h-full place-items-center px-4 text-center text-[15px] text-white/70">{emptyText}</p> : null}
        {markers.map((item) => (
          <span
            key={item.reference}
            className={`absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#3CF0FF] bg-[#041018] text-[16px] font-semibold text-[#3CF0FF] ${locked ? "pointer-events-none" : "cursor-grab"} ${!drawing && emptyText ? "hidden" : ""}`}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onPointerDown={(event) => {
              if (locked) return;
              event.stopPropagation();
              event.preventDefault();
              const board = event.currentTarget.parentElement;
              if (!board) return;
              const pointer = event.pointerId;
              event.currentTarget.setPointerCapture(pointer);
              const drag = (moveEvent: PointerEvent) => {
                const rect = board.getBoundingClientRect();
                move(item.reference, ((moveEvent.clientX - rect.left) / rect.width) * 100, ((moveEvent.clientY - rect.top) / rect.height) * 100);
              };
              const stop = () => {
                event.currentTarget.releasePointerCapture(pointer);
                event.currentTarget.removeEventListener("pointermove", drag);
                event.currentTarget.removeEventListener("pointerup", stop);
              };
              event.currentTarget.addEventListener("pointermove", drag);
              event.currentTarget.addEventListener("pointerup", stop);
            }}
            onClick={(event) => event.stopPropagation()}
          >{item.reference}</span>
        ))}
      </div>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(98, Math.max(2, value));
}
