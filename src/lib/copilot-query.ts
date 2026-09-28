import { TimeUnit } from "@prisma/client";
import { copilotSignals, type CopilotOrder, type CopilotSignal } from "@/lib/copilot";
import { orderEconomics } from "@/lib/economics";
import { withTenant } from "@/lib/prisma";

function group(lines: { id: string; name: string; quantity: number }[]) {
  const grouped = new Map<string, { id: string; name: string; quantity: number }>();
  for (const line of lines) {
    const current = grouped.get(line.id);
    if (current) current.quantity += line.quantity;
    else grouped.set(line.id, { ...line });
  }
  return [...grouped.values()];
}

function amount(value: { toString(): string } | null | undefined): number | null {
  return value == null ? null : Number(value.toString());
}

export async function companySignals(companyId: string, timeUnit: TimeUnit, now = new Date()): Promise<CopilotSignal[]> {
  return withTenant(companyId, async (tx) => {
    const orders = await tx.productionOrder.findMany({
      where: { companyId, hiddenAt: null },
      include: {
        part: true,
        estimate: { include: { toolUses: { include: { tool: true } }, materialUses: { include: { material: true } } } },
        actual: true,
        scraps: true,
        machineTimes: { include: { machine: true } },
        downtimes: { include: { machine: true } },
        toolChanges: { include: { tool: true } },
        materialConsumptions: { include: { material: true } },
        controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" } } } } } },
      },
    });
    const mapped: CopilotOrder[] = orders.flatMap((order) => {
      if (!order.estimate) return [];
      const economics = orderEconomics({
        timeUnit,
        targetQuantity: order.targetQuantity,
        timePerPiece: amount(order.estimate.timePerPiece),
        expectedScrap: amount(order.estimate.expectedScrap),
        hourlyRateSnapshot: amount(order.estimate.hourlyRateSnapshot),
        otherOperationalCost: amount(order.estimate.otherOperationalCost),
        agreedOperationalValue: amount(order.estimate.agreedOperationalValue),
        estimatedTools: order.estimate.toolUses.map((use) => ({ id: use.toolId, name: use.tool.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
        estimatedMaterials: order.estimate.materialUses.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
        machineTimes: order.machineTimes.map((interval) => ({ hourlyRateSnapshot: Number(interval.hourlyRateSnapshot), startedAt: interval.startedAt, endedAt: interval.endedAt })),
        toolChanges: order.toolChanges.map((change) => ({ id: change.toolId, name: change.tool.name, quantity: Number(change.quantity), unitCost: Number(change.unitCost) })),
        materialConsumptions: order.materialConsumptions.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity), unitCost: Number(use.unitCost) })),
        scrapPieces: order.scraps.reduce((sum, scrap) => sum + scrap.pieceCount, 0),
        now,
      });
      return [{
        id: order.id,
        phase: order.phase,
        partId: order.partId,
        partName: order.part.name,
        completedAt: order.completedAt,
        timePerPiece: amount(order.estimate.timePerPiece),
        good: order.actual?.goodQuantity ?? 0,
        scrap: order.scraps.reduce((sum, scrap) => sum + scrap.pieceCount, 0),
        agreed: amount(order.estimate.agreedOperationalValue),
        estimatedCost: economics.estimatedCost,
        actualCost: economics.actualCost,
        machineTimes: order.machineTimes.map((interval) => ({ machineId: interval.machineId, machineName: interval.machine.name, startedAt: interval.startedAt, endedAt: interval.endedAt })),
        downtimes: order.downtimes.map((interval) => ({ machineId: interval.machineId, machineName: interval.machine.name, startedAt: interval.startedAt, endedAt: interval.endedAt })),
        estimatedTools: order.estimate.toolUses.map((use) => ({ id: use.toolId, name: use.tool.name, quantity: Number(use.quantity) })),
        actualTools: group(order.toolChanges.map((change) => ({ id: change.toolId, name: change.tool.name, quantity: Number(change.quantity) }))),
        estimatedMaterials: order.estimate.materialUses.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity) })),
        actualMaterials: group(order.materialConsumptions.map((use) => ({ id: use.materialId, name: use.material.name, quantity: Number(use.quantity) }))),
        controls: (order.controlPlan?.controls ?? []).map((control) => ({
          name: control.name,
          lower: Number(control.lowerLimit),
          upper: Number(control.upperLimit),
          values: control.measurements.map((measurement) => Number(measurement.value)),
        })),
      }];
    });
    return copilotSignals(mapped, timeUnit, now);
  });
}
