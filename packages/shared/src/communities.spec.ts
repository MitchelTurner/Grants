import { describe, expect, it } from "vitest";
import { FOCUS_AREAS, SE_COMMUNITIES } from "./communities";

describe("reference lists", () => {
  it("lists the 34 Southeast communities plus three regional values", () => {
    expect(SE_COMMUNITIES).toHaveLength(37);
    expect(SE_COMMUNITIES).toContain("Juneau");
    expect(SE_COMMUNITIES).toContain("Metlakatla");
    expect(SE_COMMUNITIES).toContain("Southeast Alaska (regional)");
    expect(new Set(SE_COMMUNITIES).size).toBe(SE_COMMUNITIES.length);
  });

  it("lists each focus area once", () => {
    expect(FOCUS_AREAS).toHaveLength(20);
    expect(FOCUS_AREAS).toContain("Fisheries & Mariculture");
    expect(new Set(FOCUS_AREAS).size).toBe(FOCUS_AREAS.length);
  });
});
