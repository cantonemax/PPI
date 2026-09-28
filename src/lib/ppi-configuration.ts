import { defaultDrawingMarkers, type DrawingMarker, type DrawingReference } from "@/lib/drawing-references";

export const operationsJobCode = "CM-2026-0145";

export type AcquisitionMode = "manual" | "usb" | "bluetooth";

export type ControlRow = {
  reference: DrawingReference;
  callout: string;
  every: number;
};

export type GlobalConfiguration = {
  qualityTarget: number;
  qualityAttention: number;
  qualityCritical: number;
  gaugeStable: number;
  gaugeAttention: number;
  gaugeCritical: number;
  driftWeight: number;
  variabilityWeight: number;
  predictionMin: number;
  predictionMax: number;
  predictionConfidence: number;
  stopThreshold: number;
  extraThreshold: number;
  replaceThreshold: number;
  wearWeight: number;
  toolDriftWeight: number;
  toolVariabilityWeight: number;
  breakageWeight: number;
  learningExperience: number;
  learningMemory: number;
  learningCases: number;
};

export type OperationalConfiguration = {
  machineId: string;
  orderId: string;
  machineName: string;
  orderLabel: string;
  controls: ControlRow[];
  acquisition: AcquisitionMode;
  toolId: string;
  sound: boolean;
  showDrawing: boolean;
  autoConfirm: boolean;
  markers: DrawingMarker[];
};

const references: DrawingReference[] = ["A", "B", "C", "D", "E"];

export const defaultControls: ControlRow[] = [
  { reference: "A", callout: "Ø10 ±0.05", every: 10 },
  { reference: "B", callout: "Ø18 ±0.08", every: 20 },
  { reference: "C", callout: "H25 ±0.10", every: 10 },
  { reference: "D", callout: "SP3 ±0.02", every: 50 },
  { reference: "E", callout: "R1.5 ±0.05", every: 100 },
];

export const defaultGlobalConfiguration: GlobalConfiguration = {
  qualityTarget: 90,
  qualityAttention: 2,
  qualityCritical: 5,
  gaugeStable: 80,
  gaugeAttention: 60,
  gaugeCritical: 40,
  driftWeight: 100,
  variabilityWeight: 100,
  predictionMin: 10,
  predictionMax: 500,
  predictionConfidence: 80,
  stopThreshold: 40,
  extraThreshold: 60,
  replaceThreshold: 20,
  wearWeight: 100,
  toolDriftWeight: 100,
  toolVariabilityWeight: 100,
  breakageWeight: 100,
  learningExperience: 100,
  learningMemory: 80,
  learningCases: 3,
};

export function defaultOperationalConfiguration(machineId = "", orderId = "", machineName = "", orderLabel = ""): OperationalConfiguration {
  return {
    machineId,
    orderId,
    machineName,
    orderLabel,
    controls: defaultControls,
    acquisition: "manual",
    toolId: "",
    sound: true,
    showDrawing: false,
    autoConfirm: false,
    markers: defaultDrawingMarkers,
  };
}

const globalKey = "ppi.configuration.global";
const operationsKey = "ppi.configuration.operations";
const legacyKey = "ppi.configuration";

export function pairKey(machineId: string, orderId: string) {
  return `${machineId}:${orderId}`;
}

export function loadGlobalConfiguration(): GlobalConfiguration {
  if (typeof window === "undefined") return defaultGlobalConfiguration;
  const raw = window.localStorage.getItem(globalKey) ?? window.localStorage.getItem(legacyKey);
  if (!raw) return defaultGlobalConfiguration;
  try {
    return { ...defaultGlobalConfiguration, ...(JSON.parse(raw) as Partial<GlobalConfiguration>) };
  } catch {
    return defaultGlobalConfiguration;
  }
}

export function saveGlobalConfiguration(configuration: GlobalConfiguration) {
  window.localStorage.setItem(globalKey, JSON.stringify(configuration));
}

export function loadOperationalConfigurations(): Record<string, OperationalConfiguration> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(operationsKey);
  if (!raw) return migrateLegacyOperation();
  try {
    const parsed = JSON.parse(raw) as Record<string, OperationalConfiguration>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, normalizeOperation(value)]));
  } catch {
    return {};
  }
}

export function saveOperationalConfigurations(configurations: Record<string, OperationalConfiguration>) {
  const next = Object.fromEntries(Object.entries(configurations).map(([key, value]) => [key, normalizeOperation(value)]));
  window.localStorage.setItem(operationsKey, JSON.stringify(next));
}

export function loadOperationalMatch(machineName: string, orderLabel: string): OperationalConfiguration {
  const rows = Object.values(loadOperationalConfigurations());
  const exact = rows.find((row) => row.machineName === machineName && row.orderLabel === orderLabel);
  if (exact) return exact;
  const sameMachine = rows.filter((row) => row.machineName === machineName);
  if (sameMachine.length === 1) return sameMachine[0];
  return defaultOperationalConfiguration();
}

export function normalizeControls(rows: ControlRow[]) {
  return rows.slice(0, 5).map((row, index) => ({
    reference: references[index],
    callout: String(row.callout ?? "").trim() || defaultControls[index]?.callout || "",
    every: Number.isFinite(Number(row.every)) && Number(row.every) > 0 ? Math.round(Number(row.every)) : defaultControls[index]?.every ?? 10,
  }));
}

function normalizeOperation(value: Partial<OperationalConfiguration>): OperationalConfiguration {
  const base = defaultOperationalConfiguration(value.machineId, value.orderId, value.machineName, value.orderLabel);
  return {
    ...base,
    ...value,
    controls: Array.isArray(value.controls) ? normalizeControls(value.controls) : base.controls,
    acquisition: value.acquisition === "usb" || value.acquisition === "bluetooth" ? value.acquisition : "manual",
    markers: Array.isArray(value.markers) && value.markers.length > 0 ? value.markers : base.markers,
  };
}

function migrateLegacyOperation(): Record<string, OperationalConfiguration> {
  const raw = window.localStorage.getItem(legacyKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<OperationalConfiguration>;
    if (!Array.isArray(parsed.controls)) return {};
    const operation = normalizeOperation(parsed);
    return { [pairKey("legacy", operationsJobCode)]: { ...operation, machineName: "MILL-03", orderLabel: "125" } };
  } catch {
    return {};
  }
}
