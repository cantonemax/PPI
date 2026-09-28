import { OrderPhase, TimeUnit } from "@prisma/client";
import { orderEconomics, type OrderEconomics } from "@/lib/economics";
import { withTenant, type Db } from "@/lib/prisma";

function amount(value: { toString(): string } | null | undefined): number | null {
  return value == null ? null : Number(value.toString());
}

async function readOrder(tx: Db, companyId: string, orderId: string) {
  return tx.productionOrder.findFirst({
    where: { id: orderId, companyId, hiddenAt: null },
    include: {
      part: true,
      estimate: {
        include: {
          toolUses: { include: { tool: true } },
          materialUses: { include: { material: true } },
        },
      },
      machineTimes: true,
      toolChanges: { include: { tool: true } },
      materialConsumptions: { include: { material: true } },
      scraps: true,
    },
  });
}

export async function economicsForOrder(companyId: string, timeUnit: TimeUnit, orderId: string, now = new Date()) {
  return withTenant(companyId, async (tx) => {
    const order = await readOrder(tx, companyId, orderId);
    if (!order?.estimate) return null;
    return { partName: order.part.name, phase: order.phase, economics: toEconomics(order, timeUnit, now) };
  });
}

export async function economicsForProduction(companyId: string, timeUnit: TimeUnit, now = new Date()) {
  return withTenant(companyId, async (tx) => {
    const orders = await tx.productionOrder.findMany({
      where: { companyId, hiddenAt: null, phase: OrderPhase.IN_PRODUCTION },
      include: {
        part: true,
        estimate: {
          include: {
            toolUses: { include: { tool: true } },
            materialUses: { include: { material: true } },
          },
        },
        machineTimes: true,
        toolChanges: { include: { tool: true } },
        materialConsumptions: { include: { material: true } },
        scraps: true,
      },
      orderBy: { startedAt: "desc" },
    });
    return orders.flatMap((order) => {
      if (!order.estimate) return [];
      return [{ id: order.id, partName: order.part.name, economics: toEconomics(order, timeUnit, now) }];
    });
  });
}

function toEconomics(
  order: NonNullable<Awaited<ReturnType<typeof readOrder>>>,
  timeUnit: TimeUnit,
  now: Date,
): OrderEconomics {
  const estimate = order.estimate!;
  return orderEconomics({
    timeUnit,
    targetQuantity: order.targetQuantity,
    timePerPiece: amount(estimate.timePerPiece),
    expectedScrap: amount(estimate.expectedScrap),
    hourlyRateSnapshot: amount(estimate.hourlyRateSnapshot),
    otherOperationalCost: amount(estimate.otherOperationalCost),
    agreedOperationalValue: amount(estimate.agreedOperationalValue),
    estimatedTools: estimate.toolUses.map((use) => ({
      id: use.toolId,
      name: use.tool.name,
      quantity: Number(use.quantity),
      unitCost: Number(use.unitCost),
    })),
    estimatedMaterials: estimate.materialUses.map((use) => ({
      id: use.materialId,
      name: use.material.name,
      quantity: Number(use.quantity),
      unitCost: Number(use.unitCost),
    })),
    machineTimes: order.machineTimes.map((interval) => ({
      hourlyRateSnapshot: Number(interval.hourlyRateSnapshot),
      startedAt: interval.startedAt,
      endedAt: interval.endedAt,
    })),
    toolChanges: order.toolChanges.map((change) => ({
      id: change.toolId,
      name: change.tool.name,
      quantity: Number(change.quantity),
      unitCost: Number(change.unitCost),
    })),
    materialConsumptions: order.materialConsumptions.map((use) => ({
      id: use.materialId,
      name: use.material.name,
      quantity: Number(use.quantity),
      unitCost: Number(use.unitCost),
    })),
    scrapPieces: order.scraps.reduce((sum, scrap) => sum + scrap.pieceCount, 0),
    now,
  });
}
