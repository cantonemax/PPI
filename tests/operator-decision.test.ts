import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { operatorDecision } from "@/lib/recommended-action";
import { SPCEngine } from "@/lib/spc/spc-engine";

const band = { lsl: 9.95, usl: 10.05 };

function shown(values: number[], toolLife = 80, controlOverdue = false) {
  const decision = operatorDecision({
    hasMeasurement: values.length > 0,
    partOut: SPCEngine.outOfTolerance(values.at(-1), band.lsl, band.usl),
    processRisk: SPCEngine.activeSpcRisk(values, band.lsl, band.usl),
    toolLife,
    controlOverdue,
  });
  return {
    part: t(decision.partKey),
    process: t(decision.processKey),
    tool: t(decision.toolKey),
    action: t(decision.actionKey),
  };
}

describe("operator decision", () => {
  it("shows a good part and a stable process", () => {
    expect(shown([10, 10, 10, 10, 10])).toMatchObject({
      part: "Pezzo in specifica",
      process: "Processo stabile",
    });
  });

  it("shows a good part while the process is unstable", () => {
    expect(shown([8, 10, 10, 10, 10])).toMatchObject({
      part: "Pezzo in specifica",
      process: "Processo instabile",
    });
  });

  it("shows a bad part while the process stays stable", () => {
    const values = Array.from({ length: 6 }, () => [9.96, 10.04, 9.97, 10.03]).flat();
    values[values.length - 1] = 10.06;
    expect(shown(values)).toMatchObject({
      part: "Pezzo fuori specifica",
      process: "Processo stabile",
    });
  });

  it("shows a bad part and an unstable process together", () => {
    expect(shown([10.08, 10.09, 10.1, 10.11, 10.12])).toMatchObject({
      part: "Pezzo fuori specifica",
      process: "Processo instabile",
    });
  });

  it("asks to replace the tool when life is low", () => {
    expect(shown([10, 10, 10, 10, 10], 15).action).toBe("Sostituisci l'utensile");
    expect(shown([10, 10, 10, 10, 10], 15).tool).toBe("Sostituzione utensile consigliata");
  });

  it("asks to measure now when the control is overdue", () => {
    expect(shown([10, 10, 10, 10, 10], 80, true).action).toBe("Esegui la misura ora");
  });
});
