"use client";

import { Inter } from "next/font/google";
import { useState } from "react";
import { createPortal } from "react-dom";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600"] });
const tooltipWidth = 320;

export function InfoTip({ title, text }: { title: string; text: string }) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const heading = title.replace(/\s+/g, " ").trim();

  function place(target: HTMLButtonElement) {
    const rect = target.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - tooltipWidth, window.innerWidth - tooltipWidth - 8));
    setBox({ top: rect.bottom + 6, left });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`${heading}. ${text}`}
        className="absolute right-2 top-2 z-10 text-[12px] leading-none text-cyan-200/70 hover:text-cyan-100"
        onMouseEnter={(event) => place(event.currentTarget)}
        onMouseLeave={() => setBox(null)}
        onFocus={(event) => place(event.currentTarget)}
        onBlur={() => setBox(null)}
      >
        ⓘ
      </button>
      {box && typeof document !== "undefined"
        ? createPortal(
          <span role="tooltip" className={`${inter.className} pointer-events-none fixed z-50 rounded-md border border-white/10 bg-[#0c1c30] shadow-lg`} style={{ top: box.top, left: box.left, width: tooltipWidth, padding: "12px 14px", textAlign: "left" }}>
            <span className="block" style={{ color: "#3CF0FF", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", lineHeight: 1.45, textTransform: "uppercase" }}>{heading}</span>
            <span className="mt-1.5 block whitespace-pre-line" style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: 400, lineHeight: 1.45 }}>{text}</span>
          </span>,
          document.body,
        )
        : null}
    </>
  );
}
