export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const state = globalThis as { ppiOrderSchedule?: ReturnType<typeof setInterval> };
  if (state.ppiOrderSchedule) return;
  const { promoteDueOrders } = await import("@/server/order-activation");
  const run = () => {
    void promoteDueOrders().catch(() => undefined);
  };
  run();
  state.ppiOrderSchedule = setInterval(run, 30_000);
}
