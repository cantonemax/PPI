import { describe, expect, it } from "vitest";
import { commercialQuote } from "@/lib/commercial-quote";

describe("commercial quote", () => {
  it("derives annual gross, discount and net from the monthly list price", () => {
    expect(commercialQuote(100, 10)).toEqual({ annualGross: 1200, discountAmount: 120, annualNet: 1080 });
    expect(commercialQuote(149, 0)).toEqual({ annualGross: 1788, discountAmount: 0, annualNet: 1788 });
  });
});
