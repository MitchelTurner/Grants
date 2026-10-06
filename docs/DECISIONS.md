# Decisions

Running log of choices made where the spec was silent, or where a dependency constraint forced a narrower option. Newest first.

## 2026-10-06 — Phase 3 money tools

Phase 3 is in the app. Phase 4 is not. Awards, budgets, receipts, reimbursement forecasts, match logs, report drafts, the funder log, the Single Audit display, and Stripe Checkout plus the Customer Portal are wired. Sponsored seats, the funder portal, and the regional dashboard stay out.

- Marking an application awarded does not insert an award. A person saves the award on the setup screen, and the application must already be awarded.
- A reimbursement request uses the amount the person types. Receipts already on a request cannot be attached again.
- Generating a report writes a plain-text draft into the vault as a grant report. It does not mark the report submitted.
- The volunteer hour rate is the platform setting `VOLUNTEER_HOUR_RATE_USD`. If that value is empty, hours can be logged without a dollar amount. The Independent Sector figure is not invented here.
- A match `clientId` is unique. Sending it again for the same organization returns the existing row. Photos must already be in the vault. The match screen keeps a log on the device when the connection is down and sends it when the device is back online.
- The Single Audit tracker reads `SINGLE_AUDIT_THRESHOLD_USD`, seeded at `1000000`. If that row is missing or not a money string, the same seeded figure is used. The tracker does not create a compliance item.
- Cash-flow forecasting covers reimbursement and mixed awards. An award paid up front says so. "Not yet requested" is spending with no reimbursement request. Awaiting is a submitted request and the date the person expects to be paid.
- Report due dates remind owners and admins. Funder follow-ups remind editors. A submitted report clears its reminder.
- The Pro price is still an open question, so checkout uses the Stripe Price id in `STRIPE_PRICE_PRO`. No dollar amount is hardcoded. A missing price with a real Stripe key returns "Pro billing is not configured yet." Sponsored organizations cannot start a Pro checkout, and a cancellation notice does not remove a sponsored seat.
- `Organization.stripeSubscriptionId` is stored so a cancellation notice can return a Pro organization to Free. Card numbers are not stored.
- Tests and any boot without `STRIPE_SECRET_KEY` use an in-memory billing provider. A checkout link is not proof of payment. The plan changes when a signed `checkout.session.completed` or `checkout.session.async_payment_succeeded` notice arrives with payment status `paid` or `no_payment_required`. A deleted, canceled, unpaid, or incomplete-expired subscription returns Pro to Free.
- The installed Stripe SDK's default API version is used. Checkout is a subscription, with no `payment_method_types` and no `automatic_tax`.

## 2026-10-06 — Phase 2 writing tools

Phase 2 is in the app. Phase 3 and Phase 4 are not. The assistant is `@anthropic-ai/sdk` `messages.parse` with `zodOutputFormat`, matching the spec. Tests and any boot without `ANTHROPIC_API_KEY` use an in-memory fake. The model id is `AI_MODEL_DEFAULT`.

- A stored quota of `0` or a missing platform setting uses 100,000 tokens on Free, 1,000,000 on Pro, and 2,000,000 on Sponsored per month. A curator can replace those with a positive setting. Token price is not in the spec, so `estCostMicros` is 0.
- Parsed narrative sections are saved only when someone checks them. A deadline is saved only when its checkbox is checked. Attachments are shown and are not turned into checklist items.
- The criteria review job is `ai:report-draft`. The result is kept in Redis for 7 days. In tests the job also runs immediately so the response includes the review.
- `RfpParse` and the other Phase 2 models have `createdAt` where the sketch did not name it. A support-letter upload is stored by the member who sent the request, because the vault requires an uploader.
- The public quiz asks organization type, community, one focus area, and whether the group already receives federal funds. It lists published opportunities that are not "Not eligible", using the same fit rules as the directory. It does not save the answers.
- The data pack and past awards start empty. A curator types each figure with a source. Nothing is seeded.
- Packet passwords are scrypt hashes. The link shows the files only after the password, and download URLs last 5 minutes.
- pdf.js loads only on the RFP review screen. The first app script stays under 200 KB gzip. Standard fonts are served from `/app/standard_fonts` so a page can be drawn. They are not part of the first script.
- `pnpm eval:rfp` is manual. The fixture folder holds expected JSON for three synthetic checks. Drop in public PDFs locally before a paid run. It is not in CI.
- Local file URLs are absolute `APP_URL` links. The dev app on port 5173 rewrites only `/api/v1/dev-storage` to a same-origin path so Vite can proxy the upload and the PDF viewer. S3 links stay absolute.

## 2026-10-06 — Phase 1 is in the app; launch accounts are not

Milestones M1–M8 are implemented on top of the M0 scaffold: passwordless sign-in, organizations, the document vault, content blocks, the directory, applications, compliance, reminders, the calendar feed, the public site, the digest, export, and curator admin. Phase 2–4 (AI drafting, awards, billing, the funder portal) are not built.

The launch checklist items that need accounts outside this repository stay open: Twilio A2P 10DLC, a verified Postmark domain, curator verification of every published record, a production backup restore drill, and pilot organizations. Privacy and terms are published in the app, including the future AI disclosure. There is no Railway token here, so staging was not deployed and the backup drill was not run against production.

Critical flows are covered by API integration tests against the in-memory email, SMS, and storage providers, plus shared unit tests. Playwright is not wired: the same flows are exercised through the API suite and a browser pass of the logged-in app. Adding a browser runner is a follow-up once Chromium is part of the environment.

## 2026-10-06 — Hand-built interface instead of the shadcn CLI

The logged-in app uses a small set of hand-built controls (buttons, fields, cards) on the light theme from M0. The shadcn generator was skipped so the first JavaScript payload stays under the 200 KB gzip budget. Route screens are loaded separately. `vite-plugin-pwa` precaches the app shell. `workbox-window` is the small helper that registers the service worker.

## 2026-10-06 — HEIC photos use the browser decoder

Images are resized to 2000px and re-encoded as JPEG before upload. HEIC is converted only when `createImageBitmap` can decode it. A separate HEIC library would add a large download on the documents screen. If the browser cannot read the file, the upload asks the person to save a JPEG.

## 2026-10-06 — Session cookie is Secure only on https

`APP_URL` on a laptop is `http://localhost`. A `Secure` cookie would never be stored, so sign-in would fail. The session and CSRF cookies are `Secure` only when `APP_URL` starts with `https://`. Production Railway URLs are https, so the cookies are Secure there.

## 2026-10-06 — CSRF is skipped for public forms, webhooks, and local uploads

Mutations need `X-CSRF-Token` matching the `se_csrf` cookie. The public digest form, provider webhooks, and the local `/api/v1/dev-storage` upload URL do not send that header. The upload URL is signed, and webhooks are authenticated by the provider payload rather than a browser session.

## 2026-10-06 — Reminder mute lives on the membership

Notification preferences are per person. Muting reminders is per organization, so `Membership.remindersMuted` was added in a new migration. The spec does not name a column for that mute.

## 2026-10-06 — Other Phase 1 choices the spec leaves open

- Resend invitation is `POST /orgs/:orgId/invitations/:id/resend`.
- Phone verification codes live in Redis for 10 minutes, not in a new table.
- The calendar feed URL is shown only when the token is rotated. Only the hash is stored.
- An application has two reminder targets (`applicationId` and `applicationId:internal`) because one unique key cannot hold both due dates.
- Document expiry uses the fixed 45/14/3 day offsets, not the person's reminder offsets.
- Date-only dues fire at 17:00 in the organization time zone.
- Opportunity reminders go to owners, admins, and editors. Compliance and document expiry go to owners and admins. Checklist reminders go to the assignee. Application reminders go to the owner, or to owners and admins when no owner is set. Muted memberships are skipped.
- Overdue items stay in next actions until they are done.
- The verification queue is a query. The nightly job only changes opportunity status.
- Tests use an in-memory queue. The worker process uses BullMQ.
- The public site uses a hand-written stylesheet so pages stay small and work without JavaScript.
- `/funders` is an index page in front of the funder detail pages.
- CSV import is a dry run unless `dryRun=false`.
- An admin cannot change or remove an owner. Only an owner can.
- The city and borough funder seed is one unpublished placeholder, not an invented municipality.
- `GET /api/v1/test/mailbox` returns captured mail when `NODE_ENV=test`, and an empty list otherwise.
- The sitemap and robots file use `APP_URL` as the host.

## 2026-10-06 — Dependencies added for Phase 1

| Package                                               | Why                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `date-fns`, `date-fns-tz`                             | Deadline display and organization-local times               |
| `rrule`                                               | Compliance dates that repeat                                |
| `decimal.js`                                          | Money formatting without binary floats                      |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Private file storage and short download links               |
| `@nestjs/throttler`                                   | Rate limits on auth, invites, uploads, and public subscribe |
| `nestjs-zod`                                          | Global Zod pipe, alongside the shared schemas               |
| `handlebars`                                          | Public pages                                                |
| `archiver`                                            | Organization export zip                                     |
| `vite-plugin-pwa`, `workbox-window`, `idb`            | Installable app shell and on-device writing drafts          |

Postmark and Twilio are called with `fetch`, not their official SDKs.

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
