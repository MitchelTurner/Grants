import "reflect-metadata";
import "./instrument";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import helmet from "helmet";
import { ZodValidationPipe } from "nestjs-zod";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ENV, type Env } from "./common/config/env";
import { randomToken } from "./common/crypto";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { readCookie } from "./common/http/cookies";
import { requestIdMiddleware } from "./common/http/request-id";
import {
  MemoryStorageProvider,
  STORAGE,
  type StorageProvider,
} from "./common/storage/storage.provider";
import { HealthService } from "./modules/health/health.service";

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
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
  const env = app.get<Env>(ENV);
  const httpAdapter = http;
  httpAdapter.use(express.urlencoded({ extended: false, limit: "2mb" }));
  httpAdapter.use((req, res, next) => {
    let token = readCookie(req, "se_csrf");
    if (!token) {
      token = randomToken();
      res.cookie("se_csrf", token, {
        httpOnly: false,
        sameSite: "lax",
        secure: env.APP_URL.startsWith("https://"),
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    (req as express.Request & { csrfToken?: string }).csrfToken = token;
    next();
  });
  mountDevStorage(app, httpAdapter);
  const publicDir = [
    join(moduleDir(), "public"),
    join(process.cwd(), "src/public"),
    join(process.cwd(), "apps/api/src/public"),
  ].find((path) => existsSync(path));
  if (publicDir) {
    httpAdapter.use("/assets", express.static(publicDir));
  }
  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "/", method: RequestMethod.GET },
      { path: "grants", method: RequestMethod.GET },
      { path: "grants/:slug", method: RequestMethod.GET },
      { path: "funders", method: RequestMethod.GET },
      { path: "funders/:slug", method: RequestMethod.GET },
      { path: "about", method: RequestMethod.GET },
      { path: "privacy", method: RequestMethod.GET },
      { path: "terms", method: RequestMethod.GET },
      { path: "quiz", method: RequestMethod.GET },
      { path: "quiz", method: RequestMethod.POST },
      { path: "support/:token", method: RequestMethod.GET },
      { path: "support/:token/decline", method: RequestMethod.POST },
      { path: "support/:token/upload", method: RequestMethod.POST },
      { path: "share/:token", method: RequestMethod.GET },
      { path: "share/:token/unlock", method: RequestMethod.POST },
      { path: "digest/check-email", method: RequestMethod.GET },
      { path: "digest/confirmed", method: RequestMethod.GET },
      { path: "digest/unsubscribed", method: RequestMethod.GET },
      { path: "robots.txt", method: RequestMethod.GET },
      { path: "sitemap.xml", method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const health = app.get(HealthService);
  http.get("/health", async (_req, res) => {
    const body = await health.check();
    res.status(body.status === "ok" ? 200 : 503).json(body);
  });
  // SPEC-QUESTION: Railway marks a deployment crashed when this probe is not
  // 200. /health stays 503 while Postgres or Redis is down, so the deploy
  // probe only checks that the process is listening.
  http.get("/live", (_req, res) => {
    res.status(200).json({ status: "ok", service: "se-grants-api" });
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

function mountDevStorage(app: INestApplication, http: express.Express): void {
  const storage = app.get<StorageProvider>(STORAGE);
  if (!(storage instanceof MemoryStorageProvider)) {
    return;
  }
  const raw = express.raw({ type: () => true, limit: "26mb" });
  http.put("/api/v1/dev-storage", raw, async (req, res) => {
    const key = String(req.query.key ?? "");
    const exp = String(req.query.exp ?? "");
    const sig = String(req.query.sig ?? "");
    if (!storage.authorize("PUT", key, exp, sig)) {
      res.status(403).end();
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    await storage.put(key, body, req.header("content-type") ?? "application/octet-stream");
    res.status(204).end();
  });
  http.get("/api/v1/dev-storage", async (req, res) => {
    const key = String(req.query.key ?? "");
    const exp = String(req.query.exp ?? "");
    const sig = String(req.query.sig ?? "");
    if (!storage.authorize("GET", key, exp, sig)) {
      res.status(403).end();
      return;
    }
    const file = await storage.get(key);
    if (!file) {
      res.status(404).end();
      return;
    }
    const filename = String(req.query.filename ?? "download");
    if (req.query.attachment === "1") {
      res.setHeader(
        "content-disposition",
        `attachment; filename="${filename.replaceAll('"', "")}"`,
      );
    }
    res.type(file.contentType).send(file.body);
  });
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
