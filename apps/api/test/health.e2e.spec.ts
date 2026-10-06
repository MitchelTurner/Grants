import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/bootstrap";

describe("health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /live answers before dependencies are checked", async () => {
    const response = await request(app.getHttpServer()).get("/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "se-grants-api" });
  });

  it("GET /health reports postgres and redis", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "se-grants-api",
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("GET /api/v1/health matches the public health payload", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-request-id", "pilot-org-1");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBe("pilot-org-1");
  });

  it("returns the error envelope for unknown routes", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(typeof response.body.error.message).toBe("string");
  });

  it("GET / is the public home page", async () => {
    const response = await request(app.getHttpServer()).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Southeast Grants");
    expect(response.text).toContain("Never miss a deadline");
  });
});
