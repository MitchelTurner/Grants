import { describe, expect, it } from "vitest";
import { HealthResponse } from "./health";

describe("HealthResponse", () => {
  it("accepts a healthy payload", () => {
    const parsed = HealthResponse.parse({
      status: "ok",
      service: "se-grants-api",
      checks: { database: "ok", redis: "ok" },
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects an unknown service name", () => {
    const result = HealthResponse.safeParse({
      status: "ok",
      service: "other",
      checks: { database: "ok", redis: "ok" },
    });
    expect(result.success).toBe(false);
  });
});
