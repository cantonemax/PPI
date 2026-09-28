"use client";

import { useEffect, useState } from "react";

export function FloorClock() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => setLabel(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="text-center text-[22px] font-semibold tabular-nums tracking-[0.08em] text-stone-800">{label}</p>;
}
