import { describe, expect, it } from "vitest";
import { localStorageUrl } from "./compress";

describe("local storage URLs", () => {
  it("keeps the local upload on the page origin", () => {
    expect(localStorageUrl("http://localhost:3000/api/v1/dev-storage?key=a&sig=b")).toBe(
      "/api/v1/dev-storage?key=a&sig=b",
    );
  });

  it("leaves hosted object URLs alone", () => {
    const hosted = "https://bucket.s3.amazonaws.com/file?X-Amz-Signature=abc";
    expect(localStorageUrl(hosted)).toBe(hosted);
  });
});
