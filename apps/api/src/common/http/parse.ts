import { UnprocessableEntityException } from "@nestjs/common";
import type { ZodType } from "zod";

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new UnprocessableEntityException({
      message: "Some fields need another look.",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export function present<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Response did not match its schema");
  }
  return parsed.data;
}
