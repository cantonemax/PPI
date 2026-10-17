export function companyDeleteDecision(input: {
  confirmation: string;
  activeUsers: number;
  activeOrders: number;
}): "ready" | "blocked" | "unconfirmed" {
  if (input.confirmation !== "DELETE") return "unconfirmed";
  if (input.activeUsers > 0 || input.activeOrders > 0) return "blocked";
  return "ready";
}

export function companyLifecycle(input: {
  deletedAt: Date | null;
  closedAt: Date | null;
  contractStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
}): "deleted" | "suspended" | "trial" | "active" | "expired" {
  if (input.deletedAt) return "deleted";
  if (input.closedAt || input.contractStatus === "SUSPENDED") return "suspended";
  if (input.contractStatus === "TRIAL") return "trial";
  if (input.contractStatus === "EXPIRED") return "expired";
  return "active";
}
