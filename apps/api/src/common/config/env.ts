import { randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Third-party secrets stay optional until the milestone that calls the provider
 * (R2 in M2, Postmark and Twilio in M6, Anthropic in Phase 2, Stripe in Phase 3).
 * APP_URL and REDIS_URL are still required. Session and CSRF secrets are
 * generated for this process when unset so a deploy can finish listening.
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
  // SPEC-QUESTION: the Pro price is an open question, so it is an env price id, not a hardcoded amount.
  STRIPE_PRICE_PRO: optionalText,
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

// SPEC-QUESTION: A missing URL must not exit the process before Railway can
// reach /live. The placeholder does not point at a real database. Health
// reports the failure.
const unconfiguredDatabaseUrl = "postgresql://127.0.0.1:5432/segrants";
let warnedAboutDatabaseUrl = false;

// SPEC-QUESTION: Railway does not inject SESSION_SECRET or CSRF_SECRET unless
// they are set on the service. A missing value used to exit the process before
// /live could answer. Each unset secret is generated once per process. A
// restart changes it, so sign-in does not survive a reboot until the service
// has real values. A short explicit value is still rejected.
const generatedBootSecrets: { session?: string; csrf?: string } = {};
let warnedAboutBootSecrets = false;

function bootSecret(value: string | undefined, slot: "session" | "csrf"): string {
  if (typeof value === "string" && value.length > 0) return value;
  const existing = generatedBootSecrets[slot];
  if (existing) return existing;
  const created = randomBytes(32).toString("base64url");
  generatedBootSecrets[slot] = created;
  return created;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // SPEC-QUESTION: A linked Railway Postgres service may set DATABASE_PRIVATE_URL
  // or DATABASE_PUBLIC_URL and leave DATABASE_URL empty. Use that connection string.
  const configured =
    source.DATABASE_URL || source.DATABASE_PRIVATE_URL || source.DATABASE_PUBLIC_URL;
  const databaseUrl = configured || unconfiguredDatabaseUrl;
  if (!configured && !warnedAboutDatabaseUrl) {
    warnedAboutDatabaseUrl = true;
    console.error(
      "DATABASE_URL is not set. The process will keep listening and the health check will report the database as down.",
    );
  }
  const sessionSecret = bootSecret(source.SESSION_SECRET, "session");
  const csrfSecret = bootSecret(source.CSRF_SECRET, "csrf");
  if (
    (sessionSecret !== source.SESSION_SECRET || csrfSecret !== source.CSRF_SECRET) &&
    !warnedAboutBootSecrets
  ) {
    warnedAboutBootSecrets = true;
    console.error(
      "SESSION_SECRET or CSRF_SECRET is not set. This process generated its own. Set both on the service so sign-in survives a restart.",
    );
  }
  const withDatabase =
    databaseUrl !== source.DATABASE_URL ||
    sessionSecret !== source.SESSION_SECRET ||
    csrfSecret !== source.CSRF_SECRET
      ? {
          ...source,
          DATABASE_URL: databaseUrl,
          SESSION_SECRET: sessionSecret,
          CSRF_SECRET: csrfSecret,
        }
      : source;
  const parsed = envSchema.safeParse(withDatabase);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${formatEnvError(parsed.error)}`);
  }
  const logLevel = parsed.data.LOG_LEVEL ?? (parsed.data.NODE_ENV === "test" ? "silent" : "info");
  return { ...parsed.data, LOG_LEVEL: logLevel };
}
