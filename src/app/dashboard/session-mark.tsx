export function DatePill({ today }: { today: string }) {
  return <p className="rounded-full border border-white/10 px-3 py-1 text-[13px] text-slate-300">{today}</p>;
}

export function SessionIdentity({ name, role, align = "right" }: { name: string; role: string; align?: "left" | "right" | "center" }) {
  const placed = align === "center" ? "text-center" : align === "left" ? "text-left" : "shrink-0 text-right";
  return (
    <div className={placed}>
      {name ? <p className="text-[14px] text-white">{name}</p> : null}
      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">{role}</p>
    </div>
  );
}
