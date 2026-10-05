# Decisions

Running log of choices made where the spec was silent, or where a dependency constraint forced a narrower option. Newest first.

## 2026-10-05 — Milestone 0 stops at the scaffold

Phase 1 features (auth, orgs, vault, directory, and the rest of §8) are not implemented. The Prisma schema for Phase 1 is in place so later milestones migrate forward instead of rewriting the first migration. The seed script runs and inserts nothing; funder names and platform settings from §14 land in M4, still unpublished until a curator verifies them.

The public marketing pages (M7) are not built. `GET /` returns a short JSON document so the origin answers. `/app` serves the Vite build when `apps/web/dist` exists.

## 2026-10-05 — NestJS 11

`nestjs-zod` 5.5.0 (the spec's API validation library, used from M1 onward) declares peer support for NestJS 10 and 11 only. npm's `latest` NestJS is 12. The API is pinned to NestJS 11.2.x until `nestjs-zod` supports 12.

`nestjs-zod` itself is not installed yet. It arrives with the first validated route.

## 2026-10-05 — TypeScript 5.9

`typescript-eslint` 8.x accepts TypeScript `>=4.8.4 <6.1.0`. The npm `latest` tag is TypeScript 7, which that parser cannot load. The repo pins TypeScript 5.9.3.

## 2026-10-05 — The web app imports shared TypeScript source

`@se-grants/shared` compiles to CommonJS so Nest can `require` it. TypeScript emits re-exports as `Object.defineProperty` getters, which Vite's production build does not treat as named exports. The Vite config and the web `tsconfig` alias `@se-grants/shared` to `packages/shared/src/index.ts`. The API keeps using the built package.

## 2026-10-05 — Prisma loads the root `.env`

`packages/db/prisma.config.ts` follows the spec (`dotenv` plus `env("DATABASE_URL")`) and also reads the repository-root `.env`. Turbo runs `prisma generate` with `packages/db` as the working directory, where `import "dotenv/config"` would not see the root file.

## 2026-10-05 — Workspace package names

Packages are `@se-grants/api`, `@se-grants/web`, `@se-grants/db`, and `@se-grants/shared`. The spec's seed command `pnpm --filter db exec prisma db seed` is exposed as `pnpm db:seed`, which runs `pnpm --filter @se-grants/db exec prisma db seed`.

## 2026-10-05 — Environment validation

Core variables (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CSRF_SECRET`) are required at boot. Provider secrets (R2, Postmark, Twilio, Anthropic, Stripe, Sentry) are optional until the milestone that calls them, so local development and CI can boot. Blank strings count as unset. `PORT` defaults to 3000 because Railway injects it and §15 does not list it. `LOG_LEVEL` defaults to `silent` when `NODE_ENV=test` and `info` otherwise.

Sentry initializes only when `SENTRY_DSN` is set. The browser app reads `VITE_SENTRY_DSN` (often the same public DSN). Tracing is off (`tracesSampleRate: 0`) until there is a sampling decision.

`DATABASE_URL` and `REDIS_URL` are non-empty strings rather than `z.string().url()`, because Zod's URL check rejects the `postgresql:` and `redis:` schemes.

## 2026-10-05 — Request ids

Every response gets an `x-request-id`. A caller may send one if it matches `[A-Za-z0-9._:-]{1,128}`; anything else is replaced with a UUID. Pino stores the same id on the log line. NestJS 11 with Express 5 does not apply `nestjs-pino`'s `*` middleware to every prefixed route, so the id is also set in global middleware.

## 2026-10-05 — Health check

`GET /health` (Railway) and `GET /api/v1/health` (the app) return the same payload, validated by `HealthResponse` in `@se-grants/shared`. Either dependency failing yields HTTP 503 and `status: "degraded"`. The process still boots when Postgres or Redis is down so the probe can answer. Request logs skip these two paths.

## 2026-10-05 — Worker process

`apps/api/src/worker.ts` connects to Redis through BullMQ and stays alive. The queues in §10 are not registered yet; they arrive with the features that enqueue them (reminders in M6, export in M8). A `scaffold` queue is opened only to prove the connection, and no jobs are added.

## 2026-10-05 — PWA, shadcn, and the tab bar

`vite-plugin-pwa`, shadcn/ui, and the mobile tab bar wait until there is a logged-in shell to install and navigate (M1). The scaffold is light-theme only, mobile-width, and sets `color-scheme: light`. No web fonts, so the first paint stays small on a slow link.

## 2026-10-05 — Dependencies added for the scaffold

| Package                                                                              | Why                                                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `turbo`, `typescript`, `eslint`, `typescript-eslint`, `prettier`                     | Monorepo task runner and the §18 checks                                    |
| `prisma@^7.10`, `@prisma/client@^7.10`, `@prisma/adapter-pg`, `pg`, `dotenv`         | Prisma 7 client, as specified in §7.1                                      |
| `@nestjs/*` 11, `rxjs`, `reflect-metadata`                                           | API framework                                                              |
| `nestjs-pino`, `pino`, `pino-http`, `pino-pretty`                                    | Request logs with request IDs. `pino-pretty` is development-only           |
| `zod`                                                                                | Env validation now; shared DTOs from here on                               |
| `@sentry/nestjs`, `@sentry/react`                                                    | Error reporting when a DSN is set                                          |
| `helmet`                                                                             | Baseline CSP and security headers from §13                                 |
| `express`                                                                            | Serve the built SPA. Nest already pulls it in through the platform adapter |
| `ioredis`, `bullmq`                                                                  | Redis health check and the worker connection                               |
| `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `vite`, `tailwindcss` | Logged-in app shell                                                        |
| `vitest`, `supertest`, `unplugin-swc`, `@swc/core`                                   | Unit and API tests. SWC emits decorator metadata, which esbuild does not   |
| `tsx`                                                                                | Prisma seed command from §7.1                                              |

## 2026-10-05 — Railway

`Dockerfile` and `railway.toml` build the web service, run `prisma migrate deploy`, and probe `/health`. A second service should use the same image with start command `node apps/api/dist/worker.js`. This environment has no Railway token, so the staging service was not created from here.
