import "reflect-metadata";
import "./instrument";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { requestIdMiddleware } from "./common/http/request-id";
import { HealthService } from "./modules/health/health.service";

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const http = app.getHttpAdapter().getInstance() as express.Express;
  http.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "/", method: RequestMethod.GET }],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const health = app.get(HealthService);
  http.get("/health", async (_req, res) => {
    const body = await health.check();
    res.status(body.status === "ok" ? 200 : 503).json(body);
  });

  mountSpa(http);
  return app;
}

function moduleDir(): string {
  try {
    if (typeof __dirname === "string" && __dirname.length > 0) {
      return __dirname;
    }
  } catch {
    // Vitest transforms this file as ESM, where __dirname is not defined.
  }
  return join(process.cwd(), "src");
}

function mountSpa(http: express.Express): void {
  const webDist = join(moduleDir(), "../../web/dist");
  if (!existsSync(webDist)) {
    return;
  }
  http.use("/app", express.static(webDist), (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(join(webDist, "index.html"), (error) => {
      if (error) {
        next();
      }
    });
  });
}
