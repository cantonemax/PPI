"use client";

import { useActionState } from "react";
import { t } from "@/lib/i18n";
import { registerGoodParts, registerScrap } from "@/server/floor-actions";

export function CounterForm({ kind }: { kind: "good" | "scrap" }) {
  const action = kind === "good" ? registerGoodParts : registerScrap;
  const [state, formAction, pending] = useActionState(action, null);
  const primary = kind === "good";
  return (
    <form action={formAction}>
      <input type="hidden" name="quantity" value="1" />
      <button
        disabled={pending}
        className={
          primary
            ? "min-h-14 w-full bg-white px-4 text-2xl font-semibold text-stone-950"
            : "min-h-14 w-full border border-stone-950 bg-white px-4 text-xl font-semibold"
        }
      >
        {primary ? t("floor.plusGood") : t("floor.plusScrap")}
      </button>
      {state ? <p className="mt-2 text-sm text-red-700">{t(state)}</p> : null}
    </form>
  );
}
