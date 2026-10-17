import { companyActualMargin, companyCostDeviation } from "@/lib/economics";
import { SPCEngine } from "@/lib/spc/spc-engine";
import { recordedToolCost } from "@/lib/tool-history";

export type OwnerOrderLine = {
  id: string;
  part: string;
  actualMargin: number | null;
  costDeviation: number;
};

export type OwnerToolEvent = {
  orderId: string;
  quantity: number;
  unitCost: number;
};

export function ownerDesk(input: {
  departmentScores: readonly (number | null | undefined)[];
  averageCpk: number | null;
  efficiencyPercent: number | null;
  scrapPercent: number | null;
  orders: OwnerOrderLine[];
  toolEvents: OwnerToolEvent[];
  activeAlerts: number;
}) {
  const lines = input.orders.map((order) => ({
    ...order,
    toolCostImpact: recordedToolCost(input.toolEvents.filter((event) => event.orderId === order.id)),
  }));
  const problemOrders = lines
    .filter((order) => order.costDeviation > 0 || (order.actualMargin !== null && order.actualMargin < 0))
    .sort((left, right) => right.costDeviation - left.costDeviation || (left.actualMargin ?? 0) - (right.actualMargin ?? 0));
  return {
    departmentScore: SPCEngine.departmentScore(input.departmentScores),
    margin: companyActualMargin(input.orders),
    costDeviation: companyCostDeviation(input.orders),
    activeAlerts: input.activeAlerts,
    averageCpk: input.averageCpk,
    efficiencyPercent: input.efficiencyPercent,
    scrapPercent: input.scrapPercent,
    toolCostImpact: recordedToolCost(input.toolEvents),
    problemOrders,
  };
}

export type OwnerDeskView = ReturnType<typeof ownerDesk>;
