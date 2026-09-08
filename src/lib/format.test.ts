import { describe, expect, it } from "vitest";
import { formatBps, formatINR, formatINRWhole } from "./format";

describe("formatINR", () => {
  it("groups digits the Indian way", () => {
    expect(formatINR(123456789n)).toBe("₹12,34,567.89");
    expect(formatINR(100000000n)).toBe("₹10,00,000.00");
    expect(formatINR(99999n)).toBe("₹999.99");
    expect(formatINR(0n)).toBe("₹0.00");
    expect(formatINR(5n)).toBe("₹0.05");
  });
  it("uses a true minus sign and an optional plus", () => {
    expect(formatINR(-112025n)).toBe("−₹1,120.25");
    expect(formatINR(234050n, { sign: true })).toBe("+₹2,340.50");
    expect(formatINR(0n, { sign: true })).toBe("₹0.00");
  });
  it("rounds whole rupees half up", () => {
    expect(formatINRWhole(123456789n)).toBe("₹12,34,568");
    expect(formatINRWhole(123456749n)).toBe("₹12,34,567");
  });
});

describe("formatBps", () => {
  it("renders basis points as percentages", () => {
    expect(formatBps(234)).toBe("2.34%");
    expect(formatBps(-1250)).toBe("−12.50%");
    expect(formatBps(5, { sign: true })).toBe("+0.05%");
    expect(formatBps(0, { sign: true })).toBe("0.00%");
  });
});
