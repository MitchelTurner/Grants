import { describe, expect, it } from "vitest";
import { addMoney } from "./money";
import { dateInRange, fiscalYearContaining } from "./fiscal";

describe("fiscal year", () => {
  it("uses a July start for a spring date", () => {
    expect(fiscalYearContaining(7, "2026-03-02")).toEqual({
      start: "2025-07-01",
      end: "2026-06-30",
      label: "2025–2026",
    });
  });

  it("keeps a January start inside the calendar year", () => {
    const year = fiscalYearContaining(1, "2026-11-02");
    expect(year.start).toBe("2026-01-01");
    expect(year.end).toBe("2026-12-31");
    expect(dateInRange("2026-12-31", year.start, year.end)).toBe(true);
    expect(dateInRange("2027-01-01", year.start, year.end)).toBe(false);
  });
});

describe("money sums", () => {
  it("adds decimal strings without floats", () => {
    expect(addMoney(["10.10", "0.20", null])).toBe("10.30");
  });
});
