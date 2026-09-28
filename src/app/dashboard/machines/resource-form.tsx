"use client";

import { useActionState } from "react";
import { t } from "@/lib/i18n";
import { toolFamilies } from "@/lib/tool-families";

export function ResourceForm({
  action,
  idName,
  id,
  name,
  amountName,
  amount,
  unit,
  toolIdentity = false,
}: {
  action: (state: string | null, formData: FormData) => Promise<string | null>;
  idName?: string;
  id?: string;
  name?: string;
  amountName: "hourlyRate" | "unitCost";
  amount?: string;
  unit?: string;
  toolIdentity?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-4 flex max-w-md flex-col gap-3">
      {id && idName ? <input type="hidden" name={idName} value={id} /> : null}
      <label className="text-sm">
        {t("part.name")}
        <input name="name" defaultValue={name} required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
      </label>
      {toolIdentity ? (
        <>
          <label className="text-sm">{t("tool.description")}
            <input name="description" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">{t("part.family")}
            <select name="toolFamily" defaultValue="drill" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2">
              {toolFamilies.map((item) => <option key={item} value={item}>{t(`tool.family.${item}`)}</option>)}
            </select>
          </label>
          <label className="text-sm">{t("tool.manufacturer")}
            <input name="manufacturer" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">{t("tool.notes")}
            <input name="notes" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
          </label>
        </>
      ) : null}
      {amountName === "unitCost" ? (
        <label className="text-sm">
          {t("resource.unit")}
          <input name="unit" defaultValue={unit} required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
        </label>
      ) : null}
      <label className="text-sm">
        {t(amountName === "hourlyRate" ? "resource.hourlyRate" : "resource.unitCost")}
        <input name={amountName} defaultValue={amount} required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
      </label>
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
      <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("part.save")}</button>
    </form>
  );
}
