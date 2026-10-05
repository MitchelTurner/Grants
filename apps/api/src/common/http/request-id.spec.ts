import { describe, expect, it } from "vitest";
import { resolveRequestId } from "./request-id";

describe("resolveRequestId", () => {
  it("keeps a safe incoming id", () => {
    expect(resolveRequestId("abc-123")).toBe("abc-123");
  });

  it("replaces a missing or unsafe id", () => {
    expect(resolveRequestId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(resolveRequestId("has space")).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(["", "second"])).toMatch(/^[0-9a-f-]{36}$/);
  });
});
