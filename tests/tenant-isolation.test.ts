import { OrderPhase, Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { clearSession } from "./next-mocks";
import { requestPasswordReset, resetPassword, signIn, signUp } from "@/server/auth-actions";
import { acceptInvitation, inviteUser } from "@/server/membership-actions";
import { prisma, withTenant } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { updateOwned } from "@/lib/tenant-write";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

async function call(run: () => Promise<unknown>) {
  try {
    await run();
    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw error;
  }
}

async function asUser(email: string, password: string) {
  clearSession();
  return call(() => signIn(null, form({ email, password })));
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("tenant isolation", () => {
  const password = "isolation-pass";
  const ids: Record<string, { companyId: string; userId: string; orderId: string; measurementId: string; machineId: string; materialId: string; machineTimeId: string; featureSpcId: string }> = {};

  it("keeps the application role below superuser", async () => {
    const rows = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean; rolname: string }[]>`
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(rows[0]?.rolname).toBe("ppi_app");
    expect(rows[0]?.rolsuper).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it("prepares two companies with orders and measurements", async () => {
    await call(() => signUp(null, form({ companyName: "Isolation A", timeUnit: "HOUR", email: "iso-owner-a@demo.test", password })));
    clearSession();
    await call(() => signUp(null, form({ companyName: "Isolation B", timeUnit: "HOUR", email: "iso-owner-b@demo.test", password })));
    for (const [email, key] of [["iso-owner-a@demo.test", "a"], ["iso-owner-b@demo.test", "b"]] as const) {
      await asUser(email, password);
      const session = await readSession();
      if (!session) throw new Error("missing session");
      const seeded = await withTenant(session.companyId, async (tx) => {
        const part = await tx.part.create({ data: { companyId: session.companyId, name: `Part ${key}` } });
        const order = await tx.productionOrder.create({
          data: { companyId: session.companyId, partId: part.id, code: `ISO-${key}`, targetQuantity: 10, phase: OrderPhase.IN_PRODUCTION, startedAt: new Date() },
        });
        const plan = await tx.controlPlan.create({ data: { companyId: session.companyId, productionOrderId: order.id } });
        const control = await tx.control.create({
          data: {
            companyId: session.companyId,
            controlPlanId: plan.id,
            name: "Diameter",
            nominal: new Prisma.Decimal(10),
            lowerLimit: new Prisma.Decimal(9),
            upperLimit: new Prisma.Decimal(11),
          },
        });
        const measurement = await tx.measurement.create({
          data: { companyId: session.companyId, productionOrderId: order.id, controlId: control.id, value: new Prisma.Decimal(10), recordedAt: new Date() },
        });
        const machine = await tx.machine.create({
          data: { companyId: session.companyId, name: `Machine ${key}`, hourlyRate: new Prisma.Decimal(1) },
        });
        const material = await tx.material.create({
          data: { companyId: session.companyId, name: `Material ${key}`, unit: "kg", unitCost: new Prisma.Decimal(1) },
        });
        const machineTime = await tx.machineTime.create({
          data: { companyId: session.companyId, productionOrderId: order.id, machineId: machine.id, hourlyRateSnapshot: new Prisma.Decimal(1), startedAt: new Date() },
        });
        const featureSpc = await tx.featureSpc.create({
          data: { companyId: session.companyId, productionOrderId: order.id, controlId: control.id, insufficientData: true, sampleSize: 1, calculatedAt: new Date() },
        });
        const family = await tx.productFamily.create({ data: { companyId: session.companyId, key: `family-${key}` } });
        const tool = await tx.tool.create({ data: { companyId: session.companyId, name: `Tool ${key}`, unit: "pz", unitCost: new Prisma.Decimal(1) } });
        await tx.articleTool.create({ data: { companyId: session.companyId, partId: part.id, toolId: tool.id } });
        await tx.articleDimension.create({
          data: {
            companyId: session.companyId,
            partId: part.id,
            reference: "A",
            dimensionName: "Length",
            nominal: new Prisma.Decimal(1),
            tolerance: new Prisma.Decimal(0.1),
            lowerLimit: new Prisma.Decimal(0.9),
            upperLimit: new Prisma.Decimal(1.1),
            frequency: 1,
            markerX: new Prisma.Decimal(0),
            markerY: new Prisma.Decimal(0),
          },
        });
        return { companyId: session.companyId, userId: session.sub, orderId: order.id, measurementId: measurement.id, machineId: machine.id, materialId: material.id, machineTimeId: machineTime.id, featureSpcId: featureSpc.id, familyId: family.id, toolId: tool.id };
      });
      ids[key] = seeded;
    }
    await asUser("iso-owner-a@demo.test", password);
    for (const [email, role] of [
      ["iso-pm-a@demo.test", "PRODUCTION_MANAGER"],
      ["iso-qm-a@demo.test", "QUALITY_MANAGER"],
      ["iso-op-a@demo.test", "OPERATOR"],
    ] as const) {
      const link = await inviteUser(null, form({ email, roles: role }));
      if (!String(link).includes("/invite/")) throw new Error(`invite ${email} -> ${link}`);
      clearSession();
      const joined = await call(() => acceptInvitation(null, form({ token: String(link).split("/invite/")[1] ?? "", password })));
      if (joined !== "/dashboard") throw new Error(`accept ${email} -> ${joined}`);
      await asUser("iso-owner-a@demo.test", password);
    }
  }, 15000);

  it("blocks owner A from owner B, order B and measurement B", async () => {
    const hidden = await withTenant(ids.a.companyId, async (tx) => ({
      users: await tx.user.findMany({ where: { id: ids.b.userId } }),
      orders: await tx.productionOrder.findMany({ where: { id: ids.b.orderId } }),
      measurements: await tx.measurement.findMany({ where: { id: ids.b.measurementId } }),
      machines: await tx.machine.findMany({ where: { id: ids.b.machineId } }),
      materials: await tx.material.findMany({ where: { id: ids.b.materialId } }),
      machineTimes: await tx.machineTime.findMany({ where: { id: ids.b.machineTimeId } }),
      featureSpc: await tx.featureSpc.findMany({ where: { id: ids.b.featureSpcId } }),
    }));
    expect(hidden.users).toHaveLength(0);
    expect(hidden.orders).toHaveLength(0);
    expect(hidden.measurements).toHaveLength(0);
    expect(hidden.machines).toHaveLength(0);
    expect(hidden.materials).toHaveLength(0);
    expect(hidden.machineTimes).toHaveLength(0);
    expect(hidden.featureSpc).toHaveLength(0);
  });

  it("blocks production, quality and operator A from company B", async () => {
    for (const email of ["iso-pm-a@demo.test", "iso-qm-a@demo.test", "iso-op-a@demo.test"]) {
      const signed = await asUser(email, password);
      if (signed !== "/dashboard") throw new Error(`sign-in ${email} -> ${signed}`);
      const session = await readSession();
      if (!session) throw new Error("missing session");
      const orders = await withTenant(session.companyId, (tx) => tx.productionOrder.findMany({ where: { id: ids.b.orderId } }));
      expect(orders).toHaveLength(0);
    }
  });

  it("lets the application read every company", async () => {
    const companies = await prisma.company.findMany({ where: { name: { in: ["Isolation A", "Isolation B"] } }, select: { name: true } });
    expect(companies.map((company) => company.name).sort()).toEqual(["Isolation A", "Isolation B"]);
  });

  it("returns no tenant rows without app.company_id", async () => {
    const empty = await prisma.$transaction(async (tx) => ({
      users: await tx.user.findMany({ where: { email: { in: ["iso-owner-a@demo.test", "iso-owner-b@demo.test"] } } }),
      orders: await tx.productionOrder.findMany({ where: { code: { in: ["ISO-a", "ISO-b"] } } }),
      measurements: await tx.measurement.findMany(),
      families: await tx.productFamily.findMany({ where: { key: { in: ["family-a", "family-b"] } } }),
      tools: await tx.articleTool.findMany(),
    }));
    expect(empty.users).toHaveLength(0);
    expect(empty.orders).toHaveLength(0);
    expect(empty.measurements).toHaveLength(0);
    expect(empty.families).toHaveLength(0);
    expect(empty.tools).toHaveLength(0);
  });

  it("keeps families and article tools inside the company", async () => {
    const own = await withTenant(ids.a.companyId, async (tx) => ({
      families: await tx.productFamily.findMany(),
      tools: await tx.articleTool.findMany(),
    }));
    expect(own.families.map((family) => family.key)).toEqual(["family-a"]);
    expect(own.tools).toHaveLength(1);
    expect(own.tools[0]?.companyId).toBe(ids.a.companyId);
  });

  it("resets a password and accepts an invitation under row security", async () => {
    const link = await requestPasswordReset(null, form({ email: "iso-owner-a@demo.test" }));
    expect(String(link)).toContain("/reset-password?token=");
    const token = String(link).split("token=")[1] ?? "";
    expect(await call(() => resetPassword(null, form({ token, password: "isolation-next" })))).toBe("/login");
    expect(await asUser("iso-owner-a@demo.test", "isolation-next")).toBe("/dashboard");
    await asUser("iso-owner-a@demo.test", "isolation-next");
    const invite = await inviteUser(null, form({ email: "iso-extra-a@demo.test", roles: "OPERATOR" }));
    clearSession();
    expect(await call(() => acceptInvitation(null, form({ token: String(invite).split("/invite/")[1] ?? "", password })))).toBe("/dashboard");
  });

  it("does not write another company's order", async () => {
    const changed = await withTenant(ids.a.companyId, (tx) => updateOwned(tx.productionOrder, ids.b.orderId, ids.a.companyId, { targetQuantity: 99 }));
    expect(changed).toBe(0);
    const still = await withTenant(ids.b.companyId, (tx) => tx.productionOrder.findFirst({ where: { id: ids.b.orderId, companyId: ids.b.companyId } }));
    expect(still?.targetQuantity).toBe(10);
  });
});
