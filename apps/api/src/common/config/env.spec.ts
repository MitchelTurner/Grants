import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { formatEnvError, loadEnv } from "./env";

const valid = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/segrants",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "test-session-secret-should-be-32b",
  CSRF_SECRET: "test-csrf-secret-should-be-32chars",
};

describe("loadEnv", () => {
  it("accepts the core variables and fills defaults", () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("silent");
    expect(env.POSTMARK_BROADCAST_STREAM).toBe("digest");
    expect(env.AI_MODEL_DEFAULT).toBe("claude-sonnet-5-5");
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("treats blank optional secrets as unset", () => {
    const env = loadEnv({ ...valid, S3_BUCKET: "", SENTRY_DSN: "" });
    expect(env.S3_BUCKET).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("refuses to boot when a required secret is too short", () => {
    expect(() => loadEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("refuses to boot when the database url is missing", () => {
    const source: NodeJS.ProcessEnv = { ...valid };
    delete source.DATABASE_URL;
    expect(() => loadEnv(source)).toThrow(/DATABASE_URL/);
  });

  it("formats issues without echoing values", () => {
    const parsed = formatEnvError(new ZodError([]));
    expect(parsed).toBe("");
  });
});
