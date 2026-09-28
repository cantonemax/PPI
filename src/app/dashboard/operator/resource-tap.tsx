"use client";

import { useActionState } from "react";
import { t } from "@/lib/i18n";
import { registerMaterialConsumption, registerToolChange } from "@/server/floor-actions";

export function ResourceTap({
  kind,
  resourceId,
  name,
}: {
  kind: "tool" | "material";
  resourceId: string;
  name: string;
}) {
  const action = kind === "tool" ? registerToolChange : registerMaterialConsumption;
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="min-w-44 flex-1">
      <input type="hidden" name={kind === "tool" ? "toolId" : "materialId"} value={resourceId} />
      <input type="hidden" name="quantity" value="1" />
      <button disabled={pending} className="min-h-14 w-full bg-white px-3 text-lg">
        + {name}
      </button>
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
    </form>
  );
}
