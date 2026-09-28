import { describe, expect, it } from "vitest";
import { interpretQuality } from "@/lib/quality-evaluation";

describe("quality interpretation", () => {
  it("is optimal at or above the order target", () => {
    expect(interpretQuality(95, 90, 3, 5)).toBe("optimal");
    expect(interpretQuality(94, 90, 3, 5)).toBe("optimal");
  });

  it("is moderate below the target and at or above the warning threshold", () => {
    expect(interpretQuality(88, 90, 3, 5)).toBe("moderate");
    expect(interpretQuality(87, 90, 3, 5)).toBe("moderate");
    expect(interpretQuality(97, 98, 1, 2)).toBe("moderate");
  });

  it("is poor below the warning threshold and at or above the critical threshold", () => {
    expect(interpretQuality(86, 90, 3, 5)).toBe("poor");
    expect(interpretQuality(85, 90, 3, 5)).toBe("poor");
    expect(interpretQuality(72, 90, 10, 20)).toBe("poor");
  });

  it("is critical below the critical threshold", () => {
    expect(interpretQuality(84, 90, 3, 5)).toBe("critical");
  });

  it("changes state when the same quality is read against another target", () => {
    expect(interpretQuality(88, 90, 3, 5)).toBe("moderate");
    expect(interpretQuality(88, 85, 3, 5)).toBe("optimal");
  });
});
