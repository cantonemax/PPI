export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  const role = rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error("Il ruolo database non deve avere privilegi di superuser.");
  }
  const state = globalThis as { ppiOrderSchedule?: ReturnType<typeof setInterval> };
  if (state.ppiOrderSchedule) return;
  const { promoteDueOrders } = await import("@/server/order-activation");
  const run = () => {
    void promoteDueOrders().catch(() => undefined);
  };
  run();
  state.ppiOrderSchedule = setInterval(run, 30_000);
}
