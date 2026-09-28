import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { assignRole, inviteUser, revokeInvitation, revokeRole, revokeUser } from "@/server/membership-actions";
import { InviteForm } from "@/app/dashboard/users/invite-form";

const roleNames = Object.values(RoleName);

export default async function UsersPage() {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER)) redirect("/dashboard");

  const [users, invitations] = await withTenant(session.companyId, (tx) => Promise.all([
    tx.user.findMany({
      where: { companyId: session.companyId },
      include: { roleAssignments: { orderBy: { assignedAt: "desc" } } },
      orderBy: { email: "asc" },
    }),
    tx.invitation.findMany({
      where: { companyId: session.companyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { roles: true },
    }),
  ]));

  return (
    <main className="flex flex-col gap-10">
      <section>
        <h1 className="text-3xl">{t("users.title")}</h1>
        <p className="mt-2 text-sm text-stone-600">{t("users.inviteExpires")}</p>
        <InviteForm />
      </section>
      <section>
        <h2 className="text-xl">{t("users.openInvites")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between border border-stone-200 bg-white px-3 py-2">
              <span>{invitation.email} · {invitation.roles.map((role) => t(`users.role.${role.role}`)).join(", ")}</span>
              <form action={revokeInvitation}>
                <input type="hidden" name="invitationId" value={invitation.id} />
                <button className="text-sm">{t("users.revokeInvite")}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-4">
        {users.map((user) => (
          <article key={user.id} className="border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2>{user.email}</h2>
              <span className="text-sm">{user.revokedAt ? t("users.revoked") : t("users.active")}</span>
            </div>
            <p className="mt-3 text-sm">{t("users.history")}</p>
            <ul className="mt-1 text-sm">
              {user.roleAssignments.map((assignment) => (
                <li key={assignment.id} className="flex items-center justify-between py-1">
                  <span>{t(`users.role.${assignment.role}`)} · {assignment.revokedAt ? t("users.revoked") : t("users.active")}</span>
                  {assignment.revokedAt ? null : (
                    <form action={revokeRole}>
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <button className="text-sm">{t("users.revokeRole")}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={assignRole} className="mt-3 flex gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <select name="role" className="border border-stone-300 px-2 py-1">
                {roleNames.map((role) => <option key={role} value={role}>{t(`users.role.${role}`)}</option>)}
              </select>
              <button className="border border-stone-300 px-3 py-1 text-sm">{t("users.assign")}</button>
            </form>
            <p className="mt-2 text-xs text-stone-500">{t("users.lastOwner")}</p>
            {user.revokedAt ? null : (
              <form action={revokeUser} className="mt-2">
                <input type="hidden" name="userId" value={user.id} />
                <button className="text-sm">{t("users.revokeAccess")}</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
