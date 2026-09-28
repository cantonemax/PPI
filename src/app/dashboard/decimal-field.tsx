"use client";

import { useEffect, useRef, useState } from "react";

export function DecimalField({
  value,
  onValue,
  placeholder,
  label,
  className = "border border-stone-300 bg-white px-2 py-1",
}: {
  value: string;
  onValue: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  return (
    <input
      type="text"
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value); }}
      onChange={(event) => {
        const next = event.target.value.replace(/,/g, ".");
        if (!(next === "" || next === "-" || /^-?\d*\.?\d*$/.test(next))) return;
        setText(next);
        onValue(next);
      }}
      className={className}
    />
  );
}
