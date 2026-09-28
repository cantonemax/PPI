"use client";

import { useActionState } from "react";
import { RoleName } from "@prisma/client";
import { t } from "@/lib/i18n";
import { inviteUser } from "@/server/membership-actions";

const roles = Object.values(RoleName);

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null);
  const isLink = state?.startsWith("http");
  return (
    <form action={action} className="mt-4 flex flex-col gap-3 border border-stone-200 bg-white p-4">
      <label className="text-sm">{t("auth.email")}<input name="email" type="email" required className="mt-1 w-full border border-stone-300 px-3 py-2" /></label>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>{t("users.roles")}</legend>
        {roles.map((role) => (
          <label key={role} className="flex gap-2">
            <input type="checkbox" name="roles" value={role} />
            {t(`users.role.${role}`)}
          </label>
        ))}
      </fieldset>
      <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("users.invite")}</button>
      {state ? <p className="text-sm">{isLink ? <a href={state}>{t("users.inviteLink")}</a> : t(state)}</p> : null}
    </form>
  );
}
