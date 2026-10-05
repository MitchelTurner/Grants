import "dotenv/config";
import * as Sentry from "@sentry/nestjs";

const dsn = process.env.SENTRY_DSN;

if (typeof dsn === "string" && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
