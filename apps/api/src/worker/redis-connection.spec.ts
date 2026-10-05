import { describe, expect, it } from "vitest";
import { redisConnectionOptions } from "./redis-connection";

describe("redisConnectionOptions", () => {
  it("parses a local redis url", () => {
    expect(redisConnectionOptions("redis://localhost:6379")).toEqual({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it("parses credentials and tls", () => {
    expect(redisConnectionOptions("rediss://user:p%40ss@cache.example:6380")).toEqual({
      host: "cache.example",
      port: 6380,
      username: "user",
      password: "p@ss",
      maxRetriesPerRequest: null,
      tls: {},
    });
  });
});
