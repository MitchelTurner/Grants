# Southeast Grants

A Southeast Alaska–first grants workspace. The product spec is [`docs/SPEC.md`](docs/SPEC.md). Choices that the spec does not pin down are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

Phase 1, Phase 2, and Phase 3 are in place. Phase 1 covers passwordless sign-in, organizations, documents, writing, the directory, applications, compliance, reminders, a public site, and curator tools. Phase 2 adds RFP reading with a human review step, AI drafts, a criteria check, a curator-managed data pack, a public eligibility quiz, letters of support, packet share links, and past awards. Phase 3 adds awards and budgets, receipts, a reimbursement forecast, offline match logging, report drafts, a funder log, a Single Audit display, and Stripe Checkout with the Customer Portal. Phase 4 is not built. See the launch checklist in the spec for accounts this repo cannot finish (Twilio, Postmark, production backups, pilot organizations).

## What you need

- Node.js 22+
- pnpm 10.33.3 (`corepack enable`)
- Docker, for Postgres and Redis (`docker compose up -d`)

## Local setup

```bash
cp .env.example .env
# Fill SESSION_SECRET and CSRF_SECRET (openssl rand -base64 32).

docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

- API: http://localhost:3000/health
- App (dev): http://localhost:5173/app/
- Worker: `pnpm --filter @se-grants/api start:worker` after a build, or `pnpm --filter @se-grants/api exec nest start --watch --entryFile worker` once the API dependencies are installed

`pnpm db:seed` inserts the unpublished funder names and platform settings from the spec. A curator publishes a record only after verifying it.

The logged-in app is at `/app`. Public pages (`/`, `/grants`, `/funders`, `/quiz`, `/about`, `/privacy`, `/terms`) are server-rendered and do not need JavaScript. AI calls use `ANTHROPIC_API_KEY` when it is set. Tests and local runs without that key use a fake assistant and do not contact Anthropic. `pnpm eval:rfp` scores fixture PDFs and is not part of CI.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

API tests expect Postgres at `postgresql://postgres:postgres@localhost:5432/segrants` and Redis at `redis://localhost:6379`.

## Production shape

The Docker image serves the API and the built app. On start it applies Prisma migrations, then listens on `PORT`.

Railway web service: this repo's `Dockerfile`, health check `/health`.

Railway worker service: same image, start command `node apps/api/dist/worker.js`, no HTTP health check.
