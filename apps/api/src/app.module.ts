import type { IncomingMessage, ServerResponse } from "node:http";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { SentryModule } from "@sentry/nestjs/setup";
import { AppConfigModule } from "./common/config/config.module";
import { ENV, type Env } from "./common/config/env";
import { resolveRequestId } from "./common/http/request-id";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { QueueModule } from "./common/jobs/queue.module";
import { HealthModule } from "./modules/health/health.module";
import { Phase1Module } from "./modules/phase1.module";

const sentryImports = process.env.SENTRY_DSN ? [SentryModule.forRoot()] : [];

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

@Module({
  imports: [
    ...sentryImports,
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const id = resolveRequestId(headerValue(req.headers["x-request-id"]));
            res.setHeader("x-request-id", id);
            return id;
          },
          redact: {
            paths: [
              "req.headers.cookie",
              "req.headers.authorization",
              'req.headers["x-csrf-token"]',
            ],
            remove: true,
          },
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url === "/health" || req.url === "/api/v1/health",
          },
          transport:
            env.NODE_ENV === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    HealthModule,
    Phase1Module,
  ],
})
export class AppModule {}
