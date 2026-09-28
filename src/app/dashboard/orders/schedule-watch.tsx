"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ScheduleWatch({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const due = new Date(at).getTime();
    const refresh = () => router.refresh();
    const wait = Math.max(0, due - Date.now()) + 1500;
    const once = window.setTimeout(refresh, wait);
    const pulse = window.setInterval(refresh, 20000);
    return () => {
      window.clearTimeout(once);
      window.clearInterval(pulse);
    };
  }, [at, router]);
  return null;
}
