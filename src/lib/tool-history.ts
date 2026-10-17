export type ToolHistoryEvent = {
  toolId: string;
  orderId: string;
  partId: string;
  quantity: number;
  unitCost: number;
  occurredAt: number;
  current: boolean;
};

export type ToolEstimateLine = {
  toolId: string;
  partId: string;
  quantity: number;
};

export type ToolHistoryKpis = {
  totalToolChanges: number;
  currentToolChanges: number;
  totalEstimatedConsumption: number;
  totalToolCost: number;
  averageCostPerChange: number | null;
  firstRecordedChange: number | null;
  lastRecordedChange: number | null;
};

export type ArticleToolKpis = {
  toolChangesCount: number;
  estimatedToolUsage: number;
  toolCostImpact: number;
};

export function recordedToolCost(events: { quantity: number; unitCost: number }[]): number {
  return events.reduce((sum, event) => sum + event.quantity * event.unitCost, 0);
}

export function toolHistory(events: ToolHistoryEvent[]): ToolHistoryEvent[] {
  return [...events].sort((left, right) => right.occurredAt - left.occurredAt || left.toolId.localeCompare(right.toolId));
}

export function toolKpis(toolId: string, events: ToolHistoryEvent[], estimates: ToolEstimateLine[]): ToolHistoryKpis {
  const rows = toolHistory(events.filter((event) => event.toolId === toolId));
  const estimated = estimates.filter((line) => line.toolId === toolId).reduce((sum, line) => sum + line.quantity, 0);
  const totalToolCost = recordedToolCost(rows);
  return {
    totalToolChanges: rows.length,
    currentToolChanges: rows.filter((event) => event.current).length,
    totalEstimatedConsumption: estimated,
    totalToolCost,
    averageCostPerChange: rows.length === 0 ? null : totalToolCost / rows.length,
    firstRecordedChange: rows.length === 0 ? null : rows[rows.length - 1].occurredAt,
    lastRecordedChange: rows.length === 0 ? null : rows[0].occurredAt,
  };
}

export function articleToolKpis(partId: string, events: ToolHistoryEvent[], estimates: ToolEstimateLine[]): ArticleToolKpis {
  const rows = events.filter((event) => event.partId === partId);
  return {
    toolChangesCount: rows.length,
    estimatedToolUsage: estimates.filter((line) => line.partId === partId).reduce((sum, line) => sum + line.quantity, 0),
    toolCostImpact: recordedToolCost(rows),
  };
}
