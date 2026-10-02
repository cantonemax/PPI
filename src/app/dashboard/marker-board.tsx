"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { drawingReferences, type DrawingMarker, type DrawingReference } from "@/lib/drawing-references";

export function MarkerBoard({
  markers,
  onChange,
  drawing,
  onFile,
  emptyText,
  locked = false,
  fit = false,
  zoom = 1,
}: {
  markers: DrawingMarker[];
  onChange: (markers: DrawingMarker[]) => void;
  drawing?: { url: string; kind: "image" | "pdf" } | null;
  onFile?: (file: File) => void;
  emptyText?: string;
  locked?: boolean;
  fit?: boolean;
  zoom?: number;
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

  const marks = markers.map((item) => (
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
        const marker = event.currentTarget;
        marker.setPointerCapture(pointer);
        const drag = (moveEvent: PointerEvent) => {
          const rect = board.getBoundingClientRect();
          move(item.reference, ((moveEvent.clientX - rect.left) / rect.width) * 100, ((moveEvent.clientY - rect.top) / rect.height) * 100);
        };
        const stop = () => {
          if (marker.hasPointerCapture(pointer)) marker.releasePointerCapture(pointer);
          marker.removeEventListener("pointermove", drag);
          marker.removeEventListener("pointerup", stop);
          marker.removeEventListener("pointercancel", stop);
        };
        marker.addEventListener("pointermove", drag);
        marker.addEventListener("pointerup", stop);
        marker.addEventListener("pointercancel", stop);
      }}
      onClick={(event) => event.stopPropagation()}
    >{item.reference}</span>
  ));

  return (
    <div className={fit ? "flex h-full min-h-0 flex-col gap-2" : "flex flex-col gap-2"}>
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
      {fit && drawing?.kind === "image" ? (
        <FittedDrawing url={drawing.url} zoom={zoom} onPlace={(x, y) => { if (!locked && active) move(active, x, y); }}>
          {marks}
        </FittedDrawing>
      ) : (
      <div
        className={`relative w-full rounded-xl border border-white/10 bg-[#050d18] ${fit ? "min-h-0 flex-1" : drawing ? "" : "h-[360px]"}`}
        onClick={(event) => {
          if (locked || !active || (!drawing && emptyText)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          move(active, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
        }}
      >
        {drawing?.kind === "image" ? <img src={drawing.url} alt="" className="pointer-events-none block h-auto w-full" /> : null}
        {drawing?.kind === "pdf" ? <object data={drawing.url} type="application/pdf" className={`pointer-events-none block w-full ${fit ? "h-full" : "h-[720px]"}`} /> : null}
        {!drawing && emptyText ? <p className="grid h-full place-items-center px-4 text-center text-[15px] text-white/70">{emptyText}</p> : null}
        {marks}
      </div>
      )}
    </div>
  );
}

function FittedDrawing({ url, zoom, onPlace, children }: { url: string; zoom: number; onPlace: (x: number, y: number) => void; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [loaded, setLoaded] = useState(0);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const image = stage.querySelector("img");
      if (!image?.naturalWidth || !image.naturalHeight) return;
      const bounds = stage.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const scale = Math.min(Math.max(0, bounds.width - 2) / image.naturalWidth, Math.max(0, bounds.height - 2) / image.naturalHeight) * zoom;
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      setBox((current) => current?.width === width && current.height === height ? current : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [url, zoom, loaded]);

  return (
    <div ref={stageRef} className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-[#e7e1d4]">
      <div className="flex min-h-full min-w-full items-center justify-center">
        <div
          className="relative shrink-0"
          style={box ? { width: box.width, height: box.height } : undefined}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return;
            onPlace(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
          }}
        >
          <img src={url} alt="" onLoad={() => setLoaded((count) => count + 1)} className={`pointer-events-none ${box ? "block h-full w-full" : "absolute h-0 w-0 opacity-0"}`} />
          {children}
        </div>
      </div>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(98, Math.max(2, value));
}
