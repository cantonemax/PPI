"use client";

import { useActionState, useState } from "react";
import { t } from "@/lib/i18n";
import { type PartFamily } from "@/lib/part-families";
import { ArticleSpecEditor, specificationsFor } from "@/app/dashboard/parts/article-spec-editor";
import { createPart, updatePart } from "@/server/part-actions";

export function PartForm({ partId, name, tools = [] }: { partId?: string; name?: string; tools?: { id: string; name: string }[] }) {
  const action = partId ? updatePart : createPart;
  const [state, formAction, pending] = useActionState(action, null);
  const [family, setFamily] = useState<PartFamily>("bolt");
  const [rows, setRows] = useState(specificationsFor("bolt"));
  const [catalog, setCatalog] = useState(tools);
  const [toolIds, setToolIds] = useState<string[]>([]);
  return (
    <form action={formAction} className="mt-4 flex max-w-xl flex-col gap-3">
      {partId ? <input type="hidden" name="partId" value={partId} /> : null}
      <label className="text-sm">
        {t("part.name")}
        <input name="name" defaultValue={name} required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
      </label>
      {partId ? null : (
        <>
          <label className="text-sm">{t("part.description")}
            <input name="description" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" />
          </label>
          <input type="hidden" name="partType" value={family} />
          <input type="hidden" name="dimensions" value={JSON.stringify(rows)} />
          <input type="hidden" name="toolIds" value={JSON.stringify(toolIds)} />
          <ArticleSpecEditor family={family} onFamily={setFamily} rows={rows} onRows={setRows} onFile={() => undefined} tools={catalog} toolIds={toolIds} onTools={setToolIds} onToolCreated={(tool) => setCatalog((current) => [...current, tool])} />
        </>
      )}
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
      <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("part.save")}</button>
    </form>
  );
}
