import { describe, expect, it } from "vitest";
import { checkLabel, healthSummary } from "./health-copy";

describe("health copy", () => {
  it("uses plain language for each status", () => {
    expect(healthSummary("ok")).toBe("The workspace is up.");
    expect(healthSummary("degraded")).toMatch(/trouble/);
    expect(healthSummary("unreachable")).toMatch(/could not be reached/);
  });

  it("pairs a service name with its state", () => {
    expect(checkLabel("database", "ok")).toBe("Database is reachable.");
    expect(checkLabel("redis", "error")).toBe("Background jobs are not reachable.");
  });
});
