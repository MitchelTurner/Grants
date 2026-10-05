import { z } from "zod";

/**
 * Third-party secrets stay optional until the milestone that calls the provider
 * (R2 in M2, Postmark and Twilio in M6, Anthropic in Phase 2, Stripe in Phase 3).
 * The process still refuses to boot when a required core variable is missing.
 */
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalText = z.preprocess(blankToUndefined, z.string().min(1).optional());

const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "silent"]).optional(),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: optionalText,
  S3_BUCKET: optionalText,
  S3_BACKUP_BUCKET: optionalText,
  S3_ACCESS_KEY_ID: optionalText,
  S3_SECRET_ACCESS_KEY: optionalText,
  POSTMARK_SERVER_TOKEN: optionalText,
  POSTMARK_BROADCAST_STREAM: z.preprocess(blankToUndefined, z.string().min(1).default("digest")),
  EMAIL_FROM: optionalText,
  TWILIO_ACCOUNT_SID: optionalText,
  TWILIO_AUTH_TOKEN: optionalText,
  TWILIO_FROM_NUMBER: optionalText,
  TWILIO_MESSAGING_SERVICE_SID: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  AI_MODEL_DEFAULT: z.preprocess(blankToUndefined, z.string().min(1).default("claude-sonnet-5-5")),
  STRIPE_SECRET_KEY: optionalText,
  STRIPE_WEBHOOK_SECRET: optionalText,
  SENTRY_DSN: optionalUrl,
});

export type Env = z.infer<typeof envSchema> & {
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "silent";
};

export const ENV = Symbol("ENV");

export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${formatEnvError(parsed.error)}`);
  }
  const logLevel = parsed.data.LOG_LEVEL ?? (parsed.data.NODE_ENV === "test" ? "silent" : "info");
  return { ...parsed.data, LOG_LEVEL: logLevel };
}
