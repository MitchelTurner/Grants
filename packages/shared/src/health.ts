import { z } from "zod";

export const HealthCheckState = z.enum(["ok", "error"]);

export const HealthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("se-grants-api"),
  checks: z.object({
    database: HealthCheckState,
    redis: HealthCheckState,
  }),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
