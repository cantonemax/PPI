"use client";

import { useActionState } from "react";
import { t } from "@/lib/i18n";
import { recordMeasurement } from "@/server/quality-actions";

export function MeasureForm({ controlId }: { controlId: string }) {
  const [state, formAction, pending] = useActionState(recordMeasurement, null);
  return (
    <form action={formAction} className="mt-2 flex gap-2">
      <input type="hidden" name="controlId" value={controlId} />
      <input
        name="value"
        inputMode="decimal"
        required
        className="min-h-14 min-w-0 flex-1 border border-stone-300 bg-white px-3 text-2xl"
      />
      <button disabled={pending} className="min-h-14 bg-stone-950 px-4 text-lg text-white">
        {t("quality.record")}
      </button>
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
    </form>
  );
}
