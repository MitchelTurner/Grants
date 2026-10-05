# Southeast Grants — Product & Build Spec

> **Working name.** Find/replace `Southeast Grants` / `se-grants` once the real name and domain are chosen.
> **Owner:** Mitchel Turner Dev, LLC · **Version:** 0.1 (draft) · **Date:** 2026-10-04
> **Status:** Phase 1 ready to build. Phases 2–4 are scoped but will be refined before they start.

---

## 0. How to use this spec (read first, Cursor)

This file is the source of truth. Keep it at `docs/SPEC.md` and reference it (`@SPEC.md`) when prompting.

1. Read §1–§7 before writing any code.
2. Build **milestone by milestone** (§17). Do not start a milestone until the previous one's acceptance criteria pass. Do not build Phase 2+ features early, even "while you're in there."
3. When the spec is silent or ambiguous, pick the simplest option consistent with it, leave a `// SPEC-QUESTION: …` comment, and add an entry to `docs/DECISIONS.md`.
4. If something in this spec is wrong or unworkable, say so and propose an edit to this file. Don't silently diverge.
5. Follow the engineering conventions in §18 on every change.

---

## 1. Product summary

### Problem

Nonprofits, tribes, small businesses and small municipalities in Southeast Alaska compete for grants with almost no staff. The hard parts are rarely "finding a grant." They are:

- **Capacity:** one part-time person (or a volunteer board) doing research, writing, budgets, and reporting.
- **Continuity:** when the executive director or grant writer leaves, deadlines, funder relationships and past applications leave with them (usually in a personal Gmail).
- **Compliance:** SAM.gov renewals, Form 990s, state reports and funder reports slip, putting future funding at risk.
- **Cash flow:** reimbursement grants make small orgs float costs they can't afford.
- **Local context:** national grant databases are thin on Alaska-specific, tribal and regional funders and don't understand Southeast realities (freight, ferries, seasonal work windows, Alaska Time vs. Eastern deadlines).

### Vision

A Southeast Alaska–first grants workspace: find the right money, write faster with reusable material, never miss a deadline or renewal, and manage awards through reporting. Later, a portal that lets local funders run their own grant programs, creating a regional "common app."

### Differentiators

1. **Curated regional funder data** maintained by a human curator, with a visible "last verified" date on every record.
2. **Continuity by design:** everything lives with the organization, not the person.
3. **Built for Southeast conditions:** fast on poor connections, mobile-first, plain language, Alaska Time–aware.
4. **Post-award help** (Phase 3) that small orgs actually need: reimbursement cash-flow forecasting, volunteer match logging from a phone, report assembly.

### Non-goals (for now)

- Native iOS/Android apps (the web app is mobile-first and installable as a PWA).
- Replacing accounting software. We export CSVs for the bookkeeper/QuickBooks.
- Disbursing money to grantees.
- Scraping national grant databases.
- Writing applications without human review. AI drafts and the human submits.

---

## 2. Southeast Alaska context that shapes the product

- **~34 communities**, most off the road system (ferry, float plane, small airlines). Connectivity ranges from fiber to satellite. **Every screen must work on a slow, flaky connection and a phone.**
- **Tiny orgs, overlapping people:** the same person may be treasurer for three organizations. One login must work across multiple orgs.
- **Seasonality:** summer is fishing and tourism season, when people are busiest; much grant writing happens in winter. Construction and trail work happen in narrow weather windows.
- **Time zones:** most federal and many foundation deadlines are stated in Eastern or Pacific time. An "11:59 PM ET" deadline is 7:59 PM in Alaska. The app must always show both.
- **Tribal sovereignty:** tribes and tribal organizations must control their own data, with full export and no secondary use without explicit consent.
- **Cost realities:** budgets include barge freight, float plane charters, ferry travel, fuel, and shipping lead times.

---

## 3. Users and roles

### Personas

| Persona                          | Example                                           | Main needs                                             |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Solo ED / volunteer              | Trail association president, small arts nonprofit | Deadlines, reusable text, plain language               |
| Multi-org treasurer              | Sits on 3 boards                                  | One login, org switcher, combined weekly digest        |
| Tribal grants manager            | Tribal government or tribal nonprofit             | Federal compliance (SAM, reports), data control        |
| Small business owner             | Mariculture farm, charter operator                | "What am I eligible for?", loans as well as grants     |
| Municipal clerk                  | Small city/borough                                | Federal infrastructure NOFOs, compliance tracking      |
| Curator (platform)               | Mitchel                                           | Maintain funders/opportunities, verify, publish digest |
| Funder program officer (Phase 4) | Community foundation affiliate                    | Run a grant cycle: intake, review, award, reporting    |

### Platform roles (`User.platformRole`)

- `USER`: default.
- `CURATOR`: manage funders, opportunities, data points, and the public digest.
- `SUPERADMIN`: everything, plus platform settings and user support tools.

### Organization roles (`Membership.role`)

| Capability                                                                    | OWNER | ADMIN | EDITOR | CONTRIBUTOR | VIEWER |
| ----------------------------------------------------------------------------- | :---: | :---: | :----: | :---------: | :----: |
| Delete org, transfer ownership                                                |   ✓   |       |        |             |        |
| Manage members & billing                                                      |   ✓   |   ✓   |        |             |        |
| Edit org profile, compliance items                                            |   ✓   |   ✓   |   ✓    |             |        |
| Create/edit applications, content blocks, documents                           |   ✓   |   ✓   |   ✓    |             |        |
| Complete assigned checklist items, upload documents, log volunteer hours (P3) |   ✓   |   ✓   |   ✓    |      ✓      |        |
| Read everything in the org                                                    |   ✓   |   ✓   |   ✓    |      ✓      |   ✓    |
| Download documents                                                            |   ✓   |   ✓   |   ✓    |      ✓      |   ✓    |

VIEWER is for board members who need visibility. CONTRIBUTOR is for volunteers.

---

## 4. Phases and scope

### Phase 1: MVP ("never miss a deadline")

Auth · organizations & multi-org membership · org profile · document vault · boilerplate library · curated funder/opportunity directory with fit labels · deadline calendar + ICS feed · applications pipeline with checklists · compliance tracker · email + SMS reminders · weekly "next actions" digest · public grant directory (server-rendered) · public newsletter signup and curator-approved weekly digest · curator admin · data export.

### Phase 2: "Write faster"

NOFO/RFP parser (Claude) · AI drafting assistant · draft review against scoring criteria · Southeast data pack · public eligibility quiz · letter-of-support workflow · funder-ready packet share link · past-awardee intelligence.

### Phase 3: "Manage the money"

Awards & budgets · expenditures with receipts · reimbursement cash-flow forecaster · offline volunteer/match logging (PWA) · report generator · funder relationship log · Single Audit threshold tracker · Stripe billing.

### Phase 4: "Regional platform"

Funder portal (programs, intake, review, award, grantee reports) · Southeast Common App · sponsored seats · regional funding dashboard · collaborative multi-org applications.

---

## 5. Tech stack

| Layer              | Choice                                                                                        | Notes                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                                                   |                                                                                                                                                       |
| API                | NestJS (TypeScript, strict)                                                                   | Also serves the public server-rendered pages and the built SPA                                                                                        |
| Public pages       | Server-rendered HTML from Nest (Handlebars views) + compiled Tailwind CSS                     | No client JS required. Fast on satellite connections and good for SEO                                                                                 |
| App (logged-in)    | React + Vite + Tailwind + TanStack Query + React Router                                       | shadcn/ui components (light theme only)                                                                                                               |
| Validation         | Zod schemas in `packages/shared`, used by both API (`nestjs-zod`) and web                     | One source of truth for DTOs                                                                                                                          |
| Database           | PostgreSQL via **Prisma 7** (`prisma@^7.10`, `@prisma/client@^7.10`, `@prisma/adapter-pg`)    | Pin `^7`. As of Oct 2026 npm's `latest` tag points to an 8.0 release candidate, so a bare `npm i prisma` installs the RC. See §7.1 for Prisma 7 setup |
| Jobs               | Redis + BullMQ                                                                                | Separate worker process from the same codebase                                                                                                        |
| File storage       | Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3` + presigned URLs                       | Private bucket                                                                                                                                        |
| Email              | Postmark (transactional stream + broadcast stream for the public digest)                      | Behind an `EmailProvider` interface                                                                                                                   |
| SMS                | Twilio                                                                                        | Behind an `SmsProvider` interface. Requires A2P 10DLC registration before launch                                                                      |
| AI (Phase 2+)      | Anthropic Claude API, `@anthropic-ai/sdk`                                                     | See §11                                                                                                                                               |
| Payments (Phase 3) | Stripe Checkout + Customer Portal                                                             |                                                                                                                                                       |
| Dates              | `date-fns` + `date-fns-tz`                                                                    | Store UTC. Render in user/org time zone                                                                                                               |
| Recurrence         | `rrule`                                                                                       | Compliance items and reporting schedules                                                                                                              |
| Hosting            | Railway: `web` service, `worker` service, Postgres, Redis                                     |                                                                                                                                                       |
| Observability      | pino logs with request IDs, Sentry (API + web)                                                |                                                                                                                                                       |
| Tests              | Vitest (unit), Vitest + supertest (API integration, real Postgres), Playwright (critical e2e) |                                                                                                                                                       |

---

## 6. Architecture

```
                 ┌──────────────────────────── web service (NestJS) ───────────────────────────┐
 Browser ──────► │  /            public pages (SSR, Handlebars)                                 │
 (phone/laptop)  │  /app/*       React SPA static build (index.html fallback)                  │
                 │  /api/v1/*    REST API (cookie session auth)                                │
                 │  /webhooks/*  Twilio, Postmark, Stripe                                      │
                 └───────┬──────────────┬──────────────┬───────────────────────────────────────┘
                         │              │              │
                     PostgreSQL       Redis      Cloudflare R2 ◄── direct browser uploads (presigned PUT)
                         │              │
                 ┌───────┴──────────────┴──────┐
                 │ worker service (NestJS)      │──► Postmark, Twilio, Claude API (P2+)
                 │ BullMQ queues (§10)          │
                 └──────────────────────────────┘
```

- **Single origin** (`https://<domain>`): no CORS, simple cookies. In dev, Vite proxies `/api` to Nest.
- **Multi-tenancy:** every org-scoped table has `organizationId`. Org-scoped routes are `/api/v1/orgs/:orgId/...`. An `OrgMemberGuard` loads the membership for `(user, orgId)`, attaches it to the request, and enforces the role matrix via a `@RequireRole('EDITOR')` decorator. **Services must never fetch an org-scoped record by `id` alone.** They always filter by `organizationId` too. Not-a-member returns **404, not 403**, so org existence isn't leaked.
- **Soft deletes** (`deletedAt`) on user-created content. Hard-delete after 30 days via a nightly job.
- **Audit log** for security-relevant actions (document downloads/shares, role changes, exports, deletes).

---

## 7. Data model (Phase 1, Prisma)

Phase 1 schema below is complete. Phase 2–4 models are sketched in §7.2 and finalized when each phase starts.

**Money:** always `Decimal @db.Decimal(14, 2)`, never floats. **Dates:** `DateTime` (UTC instant) for deadlines; `@db.Date` for date-only items (compliance due dates, document expirations).

### 7.1 `packages/db/prisma/schema.prisma`

**Prisma 7 setup notes** (these differ from older Prisma tutorials Cursor may have learned from):

- The generator is `prisma-client` (not `prisma-client-js`) and requires an `output` path. Import the client from that path, not from `@prisma/client`.
- The connection URL lives in `packages/db/prisma.config.ts`, not in the schema's `datasource` block.
- `PrismaClient` is constructed with a driver adapter (`@prisma/adapter-pg`).
- `.env` is not loaded automatically. Use `dotenv` in `prisma.config.ts`; Nest loads env via its config module.
- Seeding never runs automatically. Run `pnpm --filter db exec prisma db seed` explicitly. The workspace package is named `@se-grants/db`; `pnpm db:seed` is that command.
- Client middleware (`$use`) is gone. Use Client Extensions if you need query hooks.
- NestJS builds as CommonJS here, so the generator sets `moduleFormat = "cjs"`.

`packages/db/prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

The checked-in `prisma.config.ts` also loads the repository-root `.env`, because Turbo runs this package with `packages/db` as the working directory. See `docs/DECISIONS.md`.

`packages/db/src/client.ts`:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export function createPrismaClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export * from "../generated/prisma/client";
```

Schema (validated against the Prisma 7.10 schema engine):

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

// ───────────── Enums ─────────────

enum PlatformRole {
  USER
  CURATOR
  SUPERADMIN
}

enum OrgType {
  NONPROFIT_501C3
  FISCALLY_SPONSORED
  TRIBE
  TRIBAL_ORGANIZATION
  ANCSA_CORPORATION
  MUNICIPALITY
  SMALL_BUSINESS
  INDIVIDUAL
  OTHER
}

enum MemberRole {
  OWNER
  ADMIN
  EDITOR
  CONTRIBUTOR
  VIEWER
}

enum Plan {
  FREE
  PRO
  SPONSORED
}

enum DocumentKind {
  IRS_DETERMINATION_LETTER
  W9
  FORM_990
  AUDITED_FINANCIALS
  FINANCIAL_STATEMENT
  ORG_BUDGET
  BOARD_LIST
  BYLAWS
  ARTICLES_OF_INCORPORATION
  INSURANCE_CERTIFICATE
  STRATEGIC_PLAN
  ANNUAL_REPORT
  LETTER_OF_SUPPORT
  RFP_NOFO
  GRANT_AGREEMENT
  LOGO
  PHOTO
  RECEIPT
  OTHER
}

enum ContentCategory {
  MISSION
  ORG_HISTORY
  PROGRAM_DESCRIPTION
  NEED_STATEMENT
  GOALS_OBJECTIVES
  EVALUATION_PLAN
  SUSTAINABILITY
  ORG_CAPACITY
  COMMUNITY_ENGAGEMENT
  BUDGET_NARRATIVE
  KEY_PERSONNEL
  OTHER
}

enum FunderType {
  PRIVATE_FOUNDATION
  COMMUNITY_FOUNDATION
  CORPORATE
  ANCSA_CORPORATION
  TRIBAL
  FEDERAL
  STATE
  LOCAL_GOVERNMENT
  CDFI_LENDER
  NONPROFIT_INTERMEDIARY
  OTHER
}

enum FundingForm {
  GRANT
  LOAN
  FORGIVABLE_LOAN
  IN_KIND
  PRIZE_AWARD
  CONTRACT
}

enum DeadlineType {
  FIXED
  ROLLING
  LOI_THEN_FULL
  INVITATION_ONLY
}

enum OpportunityStatus {
  DRAFT // curator-only
  UPCOMING
  OPEN
  CLOSED
  ARCHIVED
}

enum ApplicationStatus {
  PROSPECT
  PLANNING
  DRAFTING
  INTERNAL_REVIEW
  SUBMITTED
  AWARDED
  DECLINED
  WITHDRAWN
}

enum ChecklistItemKind {
  NARRATIVE
  ATTACHMENT
  BUDGET
  SIGNATURE
  SUPPORT_LETTER
  REGISTRATION
  OTHER
}

enum ItemSource {
  MANUAL
  TEMPLATE
  RFP_PARSER
}

enum ComplianceKind {
  SAM_REGISTRATION
  IRS_990
  ALASKA_BIENNIAL_REPORT
  PICK_CLICK_GIVE
  INSURANCE_RENEWAL
  BOARD_ELECTION
  ANNUAL_MEETING
  SINGLE_AUDIT
  BUSINESS_LICENSE
  FUNDER_REPORT
  CUSTOM
}

enum ReminderTarget {
  OPPORTUNITY_DEADLINE
  APPLICATION_DUE
  CHECKLIST_ITEM
  COMPLIANCE_ITEM
  DOCUMENT_EXPIRY
}

enum Channel {
  EMAIL
  SMS
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
  CANCELED
  SKIPPED
}

enum DigestIssueStatus {
  DRAFT
  APPROVED
  SENT
}

// ───────────── Identity ─────────────

model User {
  id                String       @id @default(cuid())
  email             String       @unique
  name              String?
  phone             String? // E.164, set only after SMS verification
  phoneVerifiedAt   DateTime?
  smsOptIn          Boolean      @default(false)
  timezone          String       @default("America/Juneau")
  platformRole      PlatformRole @default(USER)
  lastActiveOrgId   String?
  calendarTokenHash String?      @unique // secret for the personal ICS feed
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  sessions         Session[]
  memberships      Membership[]
  notificationPref NotificationPreference?
  reminders        Reminder[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  userAgent String?
  ip        String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

/// Magic link + 6-digit code (code lets people open the email on their phone and sign in on a laptop)
model LoginToken {
  id        String    @id @default(cuid())
  email     String
  tokenHash String    @unique
  codeHash  String
  attempts  Int       @default(0)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([email, createdAt])
}

model NotificationPreference {
  id              String @id @default(cuid())
  userId          String @unique
  emailEnabled    Boolean @default(true)
  smsEnabled      Boolean @default(false)
  weeklyDigest    Boolean @default(true)
  digestWeekday   Int     @default(1) // 0=Sun … 6=Sat
  digestHour      Int     @default(8) // local hour
  reminderOffsets Int[]   @default([30, 14, 7, 2, 1]) // days before due
  quietStartHour  Int     @default(21) // no SMS from 9pm…
  quietEndHour    Int     @default(8) // …until 8am local
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ───────────── Organizations ─────────────

model Organization {
  id                   String    @id @default(cuid())
  name                 String
  slug                 String    @unique
  type                 OrgType
  community            String // from SE_COMMUNITIES (packages/shared) or free text
  servesCommunities    String[]
  ein                  String?
  uei                  String? // SAM.gov Unique Entity ID
  website              String?
  mission              String?
  annualBudget         Decimal?  @db.Decimal(14, 2)
  fiscalYearStartMonth Int       @default(1) // 1–12
  focusAreas           String[] // from FOCUS_AREAS (packages/shared)
  receivesFederalFunds Boolean   @default(false)
  fiscalSponsorName    String?
  timezone             String    @default("America/Juneau")
  plan                 Plan      @default(FREE)
  stripeCustomerId     String?   @unique
  aggregateDataConsent Boolean   @default(false) // opt-in for anonymized regional stats (Phase 4)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  deletedAt            DateTime?

  memberships   Membership[]
  invitations   Invitation[]
  documents     Document[]
  contentBlocks ContentBlock[]
  applications  Application[]
  compliance    ComplianceItem[]
  watches       OpportunityWatch[]
  reminders     Reminder[]
  auditLogs     AuditLog[]
}

model Membership {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           MemberRole
  createdAt      DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
}

model Invitation {
  id             String     @id @default(cuid())
  organizationId String
  email          String
  role           MemberRole
  tokenHash      String     @unique
  invitedById    String
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime   @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

// ───────────── Vault & boilerplate ─────────────

model Document {
  id             String       @id @default(cuid())
  organizationId String
  kind           DocumentKind
  title          String
  storageKey     String       @unique
  mimeType       String
  sizeBytes      Int
  effectiveDate  DateTime?    @db.Date
  expiresAt      DateTime?    @db.Date
  inFunderPacket Boolean      @default(false)
  tags           String[]
  uploadedById   String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, kind])
}

model ContentBlock {
  id             String                @id @default(cuid())
  organizationId String
  category       ContentCategory
  title          String
  body           String // markdown
  wordCount      Int
  charCount      Int
  lastReviewedAt DateTime              @default(now())
  version        Int                   @default(1)
  createdById    String
  updatedById    String
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  deletedAt      DateTime?
  organization   Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  versions       ContentBlockVersion[]

  @@index([organizationId, category])
}

model ContentBlockVersion {
  id             String       @id @default(cuid())
  contentBlockId String
  version        Int
  title          String
  body           String
  editedById     String
  createdAt      DateTime     @default(now())
  contentBlock   ContentBlock @relation(fields: [contentBlockId], references: [id], onDelete: Cascade)

  @@unique([contentBlockId, version])
}

// ───────────── Directory (global, curated) ─────────────

model Funder {
  id               String        @id @default(cuid())
  name             String
  slug             String        @unique
  type             FunderType
  website          String?
  description      String? // curator-written, plain language
  geographicFocus  String[] // e.g. ["Alaska"], ["Southeast Alaska"], ["Ketchikan"]
  focusAreas       String[]
  eligibleOrgTypes OrgType[]
  curatorNotes     String? // internal only, never rendered publicly
  isPublished      Boolean       @default(false)
  lastVerifiedAt   DateTime?
  verifiedById     String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  opportunities    Opportunity[]
}

model Opportunity {
  id                  String            @id @default(cuid())
  funderId            String
  title               String
  slug                String            @unique
  summary             String // curator-written, plain language
  url                 String?
  fundingForm         FundingForm       @default(GRANT)
  eligibleOrgTypes    OrgType[] // empty = see summary / not restricted
  eligibleCommunities String[] // empty = not restricted within funder's geography
  focusAreas          String[]
  minAmount           Decimal?          @db.Decimal(14, 2)
  maxAmount           Decimal?          @db.Decimal(14, 2)
  matchRequired       Boolean           @default(false)
  matchNotes          String?
  deadlineType        DeadlineType
  deadlineAt          DateTime? // exact instant (UTC)
  deadlineTimezone    String? // funder's stated tz, e.g. "America/New_York"
  loiDeadlineAt       DateTime?
  opensAt             DateTime?
  recurrenceNote      String? // e.g. "Usually opens each February"
  assistanceListing   String? // federal Assistance Listing number, if any
  requiresSam         Boolean           @default(false)
  status              OpportunityStatus @default(DRAFT)
  isPublic            Boolean           @default(true)
  curatorNotes        String?
  lastVerifiedAt      DateTime?
  verifiedById        String?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  funder              Funder            @relation(fields: [funderId], references: [id])
  watches             OpportunityWatch[]
  applications        Application[]

  @@index([status, deadlineAt])
  @@index([funderId])
}

model OpportunityWatch {
  id             String       @id @default(cuid())
  organizationId String
  opportunityId  String
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  opportunity    Opportunity  @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([organizationId, opportunityId])
}

// ───────────── Applications ─────────────

model Application {
  id               String            @id @default(cuid())
  organizationId   String
  opportunityId    String?
  customFunderName String? // when the funder isn't in the directory
  title            String
  status           ApplicationStatus @default(PROSPECT)
  amountRequested  Decimal?          @db.Decimal(14, 2)
  amountAwarded    Decimal?          @db.Decimal(14, 2)
  funderDeadlineAt DateTime? // copied from opportunity, overridable
  internalDueAt    DateTime? // default: funder deadline minus buffer (§8 F8)
  submittedAt      DateTime?
  decisionAt       DateTime?
  ownerUserId      String?
  notes            String?
  declineFeedback  String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?
  organization     Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  opportunity      Opportunity?      @relation(fields: [opportunityId], references: [id])
  checklist        ChecklistItem[]

  @@index([organizationId, status])
}

model ChecklistItem {
  id               String            @id @default(cuid())
  applicationId    String
  label            String
  kind             ChecklistItemKind @default(OTHER)
  source           ItemSource        @default(MANUAL)
  sortOrder        Int               @default(0)
  dueAt            DateTime?
  assigneeId       String?
  doneAt           DateTime?
  linkedDocumentId String?
  notes            String?
  application      Application       @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
}

// ───────────── Compliance & reminders ─────────────

model ComplianceItem {
  id               String         @id @default(cuid())
  organizationId   String
  kind             ComplianceKind
  title            String
  description      String?
  dueAt            DateTime       @db.Date
  rrule            String? // RFC 5545, e.g. "FREQ=YEARLY;INTERVAL=1"
  lastCompletedAt  DateTime?
  linkedDocumentId String?
  isActive         Boolean        @default(true)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  organization     Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, dueAt])
}

model Reminder {
  id             String         @id @default(cuid())
  organizationId String
  targetType     ReminderTarget
  targetId       String
  recipientId    String
  channel        Channel
  offsetDays     Int
  dueAtSnapshot  DateTime // the due date this reminder was computed from
  sendAt         DateTime
  status         ReminderStatus @default(PENDING)
  sentAt         DateTime?
  error          String?
  createdAt      DateTime       @default(now())
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  recipient      User           @relation(fields: [recipientId], references: [id], onDelete: Cascade)

  @@unique([targetType, targetId, recipientId, channel, offsetDays])
  @@index([status, sendAt])
}

// ───────────── Public digest ─────────────

model DigestSubscriber {
  id               String    @id @default(cuid())
  email            String    @unique
  communities      String[]
  focusAreas       String[]
  confirmTokenHash String?   @unique
  unsubTokenHash   String    @unique
  confirmedAt      DateTime?
  unsubscribedAt   DateTime?
  createdAt        DateTime  @default(now())
}

model DigestIssue {
  id             String            @id @default(cuid())
  subject        String
  bodyMd         String
  opportunityIds String[]
  status         DigestIssueStatus @default(DRAFT)
  approvedById   String?
  sentAt         DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
}

// ───────────── Platform ─────────────

/// Curated values that change over time (regulatory thresholds, rates). Never hardcode these.
model PlatformSetting {
  key         String    @id
  value       String
  description String
  sourceUrl   String?
  verifiedAt  DateTime?
  updatedAt   DateTime  @updatedAt
}

model AuditLog {
  id             String        @id @default(cuid())
  organizationId String?
  userId         String?
  action         String // e.g. "document.download", "membership.role_changed", "org.export"
  entityType     String
  entityId       String?
  metadata       Json?
  ip             String?
  createdAt      DateTime      @default(now())
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  @@index([organizationId, createdAt])
}
```

### 7.2 Later-phase models (sketch, finalize when the phase starts)

| Phase | Model                                                                                                                                                          | Key fields                                                                                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2     | `ApplicationSection`                                                                                                                                           | applicationId, heading, prompt, wordLimit?, charLimit?, body (md), sortOrder, source (MANUAL/RFP_PARSER)                                                                            |
| 2     | `RfpParse`                                                                                                                                                     | organizationId, applicationId?, documentId, status (QUEUED/RUNNING/NEEDS_REVIEW/APPLIED/FAILED), model, result (Json), confirmedAt, error                                           |
| 2     | `AiUsage`                                                                                                                                                      | organizationId, userId, feature, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, estCostMicros, createdAt                                                      |
| 2     | `DataPoint`                                                                                                                                                    | community, metric, value, unit, year, sourceName, sourceUrl, retrievedAt, curatorId                                                                                                 |
| 2     | `SupportLetterRequest`                                                                                                                                         | applicationId, partnerName, partnerEmail, draftBody, tokenHash, status (REQUESTED/VIEWED/UPLOADED/DECLINED), dueAt, uploadedDocumentId                                              |
| 2     | `PacketShare`                                                                                                                                                  | organizationId, tokenHash, documentIds[], expiresAt, passwordHash?, viewCount                                                                                                       |
| 2     | `PastAward`                                                                                                                                                    | funderId, recipientName, recipientOrgId?, community, amount, year, purpose, sourceUrl                                                                                               |
| 3     | `Award`                                                                                                                                                        | applicationId (unique), amount, startDate, endDate, paymentType (ADVANCE/REIMBURSEMENT/MIXED), isFederal, assistanceListing, matchRequiredAmount, restrictions, agreementDocumentId |
| 3     | `BudgetLine`                                                                                                                                                   | awardId, category (PERSONNEL/FRINGE/TRAVEL/FREIGHT/EQUIPMENT/SUPPLIES/CONTRACTUAL/CONSTRUCTION/OTHER/INDIRECT), description, budgeted, isMatch                                      |
| 3     | `Expenditure`                                                                                                                                                  | awardId, budgetLineId, date, amount, vendor, description, receiptDocumentId, reimbursementRequestId?                                                                                |
| 3     | `ReimbursementRequest`                                                                                                                                         | awardId, periodStart, periodEnd, amount, submittedAt, expectedPaidAt, paidAt, status                                                                                                |
| 3     | `MatchEntry`                                                                                                                                                   | organizationId, awardId?, userId?, volunteerName, date, hours?, inKindValue?, rate, description, photoDocumentIds[], lat?, lng?, clientId (unique, offline dedupe)                  |
| 3     | `ReportRequirement`                                                                                                                                            | awardId, kind (PROGRESS/FINANCIAL/FINAL/OTHER), dueAt, periodStart, periodEnd, status, submittedAt, generatedDocumentId                                                             |
| 3     | `Metric`, `MetricEntry`                                                                                                                                        | awardId, name, target, unit / metricId, value, date, note                                                                                                                           |
| 3     | `FunderInteraction`                                                                                                                                            | organizationId, funderId?, contactName, contactEmail, date, type (CALL/EMAIL/MEETING/SITE_VISIT), summary, followUpAt                                                               |
| 4     | `GrantProgram`, `ProgramCycle`, `ProgramForm` (JSON schema), `Submission`, `ReviewAssignment`, `Review` (scores, comments, conflictDeclared), `SponsorAccount` | finalize at Phase 4                                                                                                                                                                 |

## 8. Phase 1 features & acceptance criteria

### F1. Authentication

Passwordless email sign-in: magic link **and** a 6-digit code in the same email.

- [ ] `POST /auth/login-request` always returns 200 (no account enumeration); rate-limited per email and per IP.
- [ ] Link and code expire in 15 minutes and work once. Max 5 code attempts per token.
- [ ] First sign-in creates the `User`. If they have a pending invitation, it's accepted automatically.
- [ ] Session: httpOnly, Secure, SameSite=Lax cookie holding a random token. Only its SHA-256 hash is stored. 30-day sliding expiry.
- [ ] CSRF: mutations require an `X-CSRF-Token` header matching a double-submit cookie.
- [ ] Logout deletes the session. "Sign out everywhere" deletes all of the user's sessions.

### F2. Organizations, members, invitations

- [ ] Create org via a short wizard: name, type, community, focus areas, "do you receive federal funds?" (EIN/UEI/budget optional, can be added later).
- [ ] Creator becomes OWNER. Org slug is auto-generated and unique.
- [ ] Org switcher in the header. Remembers `lastActiveOrgId`.
- [ ] Invite by email with role. Invitation expires in 14 days. Admins can resend/revoke.
- [ ] Role changes and removals are audit-logged. An org must always have ≥1 OWNER.
- [ ] Tenant isolation test suite: for every org-scoped endpoint, a user from Org B gets 404 on Org A's resources (generated table-driven test).

### F3. Org profile

- [ ] Profile page with plain-language helper text for each field. Example: "UEI: your 12-character federal ID from SAM.gov. You only need this for federal grants."
- [ ] Profile completeness meter (what's missing and why it matters).
- [ ] Changing `type` or `receivesFederalFunds` offers to add the matching compliance templates (F9).

### F4. Document vault

- [ ] Upload: browser requests presigned PUT (`POST /orgs/:orgId/documents/upload-url`), uploads directly to R2, then confirms metadata. Server verifies object size/type with a HEAD request before creating the `Document`.
- [ ] Limits: 25 MB/file; allowed types: PDF, DOCX, XLSX, PNG, JPG, HEIC (converted client-side to JPG), TXT, CSV.
- [ ] Images are compressed client-side to max 2000px before upload (saves bandwidth on rural connections).
- [ ] Upload retries automatically on network failure (3 attempts, exponential backoff) with a visible progress bar.
- [ ] Documents grouped by kind with a "funder packet" checklist showing which standard documents are missing (IRS letter, W-9, board list, budget, financials, insurance certificate).
- [ ] `expiresAt` creates `DOCUMENT_EXPIRY` reminders (45/14/3 days).
- [ ] Download uses a presigned GET URL valid for 5 minutes. Every download is audit-logged.

### F5. Boilerplate library ("content blocks")

- [ ] Markdown editor (simple: bold, italic, lists, links) with live word + character counts.
- [ ] **Autosave** every 3 seconds to IndexedDB and every 10 seconds to the server. If the connection drops, nothing is lost. A "Saved / Saving… / Offline, saved on this device" indicator.
- [ ] Every save that changes body or title creates a `ContentBlockVersion`. Version history with restore.
- [ ] One-click "Copy" (plain text and markdown variants).
- [ ] "Needs review" badge when `lastReviewedAt` > 12 months ago, plus a "Mark reviewed" button.
- [ ] Starter templates per category with prompts ("In 2–3 sentences, who do you serve and why?").

### F6. Funder & opportunity directory

**Curator side (admin):**

- [ ] CRUD for funders and opportunities. Markdown summary. Publish/unpublish.
- [ ] "Verify" action sets `lastVerifiedAt`/`verifiedById`. A verification queue lists records not verified in `OPPORTUNITY_STALE_DAYS` (setting, default 90).
- [ ] CSV import for opportunities (dry-run preview, then commit).
- [ ] Deadline input: date + time + **time zone picker** (defaults to America/New_York for FEDERAL funders, America/Juneau otherwise).

**Org side:**

- [ ] Search/filter: text, funder type, funding form, focus area, community, status (open/upcoming), amount range, "deadline within N days."
- [ ] **Fit label** per opportunity for the active org (rules-based, no AI). Displayed as "Good fit," "Possible fit," or "Not eligible," always with plain reasons:
  - Not eligible: `eligibleOrgTypes` non-empty and the org type isn't in it, or `eligibleCommunities` non-empty and the org's community/served communities don't intersect.
  - Score: +40 org type explicitly eligible (+20 if unrestricted), +25 community match (+15 if unrestricted), +10 per overlapping focus area (max +30). ≥70 = Good fit, else Possible fit.
- [ ] Every opportunity shows "Last verified: <date>" and a link to the funder's page. Unverified/stale records show a caution note.
- [ ] **Deadline display rule (everywhere):** show the deadline in the viewer's time zone; if the funder's time zone differs, also show the original ("Thu, Mar 12 · 7:59 PM Alaska (11:59 PM Eastern)") with a highlighted chip.
- [ ] If `requiresSam` and the org has no UEI or its SAM compliance item expires before the deadline, show a warning: "This requires an active SAM.gov registration. Registration can take several weeks. Start now."
- [ ] "Watch" an opportunity → it appears on the calendar and gets reminders.

### F7. Calendar + ICS feed

- [ ] Month and agenda views merging: watched opportunity deadlines, application internal + funder deadlines, checklist due dates, compliance due dates, document expirations. Color-coded by type, with a filter.
- [ ] Mobile defaults to agenda view.
- [ ] Personal ICS feed URL (`/api/v1/calendar/feed/:token.ics`) covering all of the user's orgs. Rotatable token. Events include links back to the app.

### F8. Applications pipeline

- [ ] Kanban by status (drag-and-drop on desktop, status dropdown on mobile) plus a sortable list view.
- [ ] Create from an opportunity (pre-fills title, funder deadline, amount range, and a template checklist based on funder type) or create custom.
- [ ] Default `internalDueAt` = funder deadline minus `DEFAULT_INTERNAL_BUFFER_BUSINESS_DAYS` (setting, default 3). Federal submission portals can be slow.
- [ ] Checklist: add/reorder/assign/due date/complete. Link an item to a vault document (auto-completes ATTACHMENT items).
- [ ] Moving to DECLINED prompts for funder feedback (stored for next time). Moving to AWARDED records amount and date (Phase 3 will launch the award setup wizard here).
- [ ] Application detail shows days remaining, open checklist items, and missing packet documents.

### F9. Compliance tracker

- [ ] List of compliance items with due date, recurrence, and status (OK / due soon / overdue).
- [ ] "Mark complete" sets `lastCompletedAt` and, if `rrule` is set, rolls `dueAt` forward to the next occurrence.
- [ ] Templates offered at org creation and on profile change (user confirms each; dates are user-entered because many depend on the org's own filings):
  - All orgs: insurance renewal, board election/annual meeting (if applicable).
  - `NONPROFIT_501C3`: IRS Form 990 (default due date computed as the 15th day of the 5th month after fiscal year end, editable), Alaska biennial corporate report (user enters date), Pick.Click.Give annual application (user enters date).
  - `receivesFederalFunds` or TRIBE/MUNICIPALITY: SAM.gov registration renewal (yearly; user enters the expiration shown in SAM.gov).
  - `SMALL_BUSINESS`: business license renewal (user enters date).
- [ ] Each template includes a one-paragraph plain-language explanation and an official link (curator-maintained in `packages/shared/compliance-templates.ts`).

### F10. Reminders & weekly digest

- [ ] Reminders for: application internal due, funder deadline, checklist item due (assignee only), compliance due, document expiry, watched opportunity deadline.
- [ ] Recipients: application owner + assignees + org ADMIN/OWNERs (compliance) by default; each user can mute per org.
- [ ] Offsets from `NotificationPreference.reminderOffsets` (default 30/14/7/2/1 days). Email always (unless disabled). SMS only if verified phone + opted in, and only for ≤2-day reminders by default.
- [ ] SMS respects quiet hours (shift to `quietEndHour` local time). SMS copy fits in one segment where possible:
      `SE Grants: Rasmuson app due in 2 days (3 items left). <short link>`
- [ ] SMS STOP/START handled via Twilio webhook (sets `smsOptIn`).
- [ ] Phone verification by SMS code before any SMS is sent.
- [ ] **Weekly digest email** at the user's chosen weekday/hour: across all their orgs, "Your next 3 actions," then everything due in the next 14 days, new opportunities that fit their orgs, and expiring documents. Skipped if there's nothing to say.
- [ ] Every email has a one-click link to the exact item and a "manage notifications" link.

### F11. Public site (server-rendered)

- [ ] `/`: what it is, who it's for, free sign-up, newsletter signup.
- [ ] `/grants`: published opportunities, filterable via query params (works with no JavaScript).
- [ ] `/grants/:slug` and `/funders/:slug`: detail pages with "last verified," deadline display rule, and "Track this in your workspace" CTA.
- [ ] `/about`, `/privacy`, `/terms`.
- [ ] Page weight budget: ≤ 60 KB transferred (excluding images) and no required JS. Proper `<title>`, meta description, Open Graph tags, sitemap.xml, robots.txt.
- [ ] Never render `curatorNotes` or DRAFT/unpublished records.

### F12. Public newsletter: "Southeast Grants Digest"

- [ ] Subscribe form (email, optional communities and focus areas) with double opt-in.
- [ ] Weekly job drafts a `DigestIssue` from opportunities published/updated in the last 7 days plus deadlines in the next 30 days, filtered later per subscriber preferences.
- [ ] **Curator must review, edit and approve** before sending. Nothing goes out automatically.
- [ ] Sent via Postmark broadcast stream with List-Unsubscribe headers. One-click unsubscribe.

### F13. Dashboard

- [ ] Org home: "Next actions" (same algorithm as the digest), upcoming deadlines (14 days), applications by status, profile/packet completeness, expiring documents.
- [ ] Next-actions algorithm: collect open checklist items for applications due within 21 days, compliance items due within 30 days, documents expiring within 45 days, watched opportunities closing within 30 days; sort by due date, then by type priority (compliance > application > document > opportunity); show top 5.

### F14. Data export & deletion

- [ ] OWNER can request a full export: JSON of all org data plus all files, zipped by a background job, stored in R2, emailed as a link valid for 7 days. Audit-logged.
- [ ] OWNER can delete the org (type the org name to confirm). Soft-delete immediately, hard-delete (including files) after 30 days.

### F15. Curator admin

- [ ] `/app/admin` (CURATOR+): funders, opportunities, verification queue, CSV import, digest issues, platform settings (SUPERADMIN only), user lookup (SUPERADMIN only, read-only).

---

## 9. API surface (v1)

All routes are under `/api/v1`, JSON, Zod-validated. Errors use `{ error: { code, message, details? } }`. List endpoints use cursor pagination (`?cursor=&limit=`, default 25, max 100).

| Area         | Routes                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `POST /auth/login-request` · `POST /auth/verify` (code) · `GET /auth/verify?token=` (link) · `POST /auth/logout` · `POST /auth/logout-all`                                                                                                                                                  |
| Me           | `GET /me` · `PATCH /me` · `POST /me/phone` (send code) · `POST /me/phone/verify` · `GET/PATCH /me/notifications` · `POST /me/calendar-token/rotate`                                                                                                                                         |
| Orgs         | `GET /orgs` · `POST /orgs` · `GET/PATCH/DELETE /orgs/:orgId` · `POST /orgs/:orgId/export`                                                                                                                                                                                                   |
| Members      | `GET /orgs/:orgId/members` · `PATCH/DELETE /orgs/:orgId/members/:membershipId` · `POST /orgs/:orgId/invitations` · `DELETE /orgs/:orgId/invitations/:id` · `POST /invitations/accept`                                                                                                       |
| Documents    | `POST /orgs/:orgId/documents/upload-url` · `POST /orgs/:orgId/documents` · `GET /orgs/:orgId/documents` · `PATCH/DELETE /orgs/:orgId/documents/:id` · `GET /orgs/:orgId/documents/:id/download-url`                                                                                         |
| Content      | `GET/POST /orgs/:orgId/content-blocks` · `GET/PATCH/DELETE /orgs/:orgId/content-blocks/:id` · `GET /orgs/:orgId/content-blocks/:id/versions` · `POST /orgs/:orgId/content-blocks/:id/restore/:version`                                                                                      |
| Directory    | `GET /opportunities` (filters + `fitForOrgId`) · `GET /opportunities/:slug` · `GET /funders` · `GET /funders/:slug` · `PUT/DELETE /orgs/:orgId/watches/:opportunityId`                                                                                                                      |
| Applications | `GET/POST /orgs/:orgId/applications` · `POST /orgs/:orgId/applications/from-opportunity/:opportunityId` · `GET/PATCH/DELETE /orgs/:orgId/applications/:id` · `POST/PATCH/DELETE /orgs/:orgId/applications/:id/checklist[/:itemId]` · `POST /orgs/:orgId/applications/:id/checklist/reorder` |
| Compliance   | `GET/POST /orgs/:orgId/compliance` · `PATCH/DELETE /orgs/:orgId/compliance/:id` · `POST /orgs/:orgId/compliance/:id/complete` · `GET /compliance/templates?orgType=`                                                                                                                        |
| Calendar     | `GET /orgs/:orgId/calendar?from=&to=` · `GET /calendar/feed/:token.ics`                                                                                                                                                                                                                     |
| Dashboard    | `GET /orgs/:orgId/dashboard`                                                                                                                                                                                                                                                                |
| Admin        | `/admin/funders` · `/admin/opportunities` · `/admin/opportunities/:id/verify` · `/admin/opportunities/import` (`?dryRun=true`) · `/admin/verification-queue` · `/admin/digest-issues` (+ `/:id/approve`, `/:id/send`) · `/admin/settings`                                                   |
| Public       | `POST /public/digest/subscribe` · `GET /public/digest/confirm?token=` · `GET /public/digest/unsubscribe?token=`                                                                                                                                                                             |
| Webhooks     | `POST /webhooks/twilio` · `POST /webhooks/postmark` (bounces/complaints) · `POST /webhooks/stripe` (Phase 3)                                                                                                                                                                                |

---

## 10. Background jobs (BullMQ)

The worker runs from `apps/api/src/worker.ts`. All jobs are idempotent and safe to retry.

| Queue / job               | Trigger                                    | Behavior                                                                                                                            |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `reminders:send`          | Delayed job, `jobId = reminder.id`         | Re-load target; if done/deleted or due date changed from `dueAtSnapshot`, mark SKIPPED. Otherwise send via email/SMS and mark SENT. |
| `reminders:sync`          | Any create/update/delete of a dated entity | Recompute reminders for that target: cancel stale PENDING ones, upsert new ones, enqueue delayed jobs.                              |
| `reminders:sweep`         | Repeatable, every 15 min                   | Enqueue PENDING reminders due in the next 30 min that lack a queued job (recovers from Redis loss).                                 |
| `digest:user-weekly`      | Repeatable, hourly                         | Find users whose local weekday/hour matches their preference and who haven't received this week's digest; build and send.           |
| `digest:public-draft`     | Repeatable, weekly (Sunday 6 PM Alaska)    | Draft a `DigestIssue` for curator review.                                                                                           |
| `digest:public-send`      | Curator clicks Send                        | Send in batches to confirmed subscribers, filtered by preferences.                                                                  |
| `opportunities:lifecycle` | Nightly                                    | OPEN past deadline → CLOSED. UPCOMING with `opensAt` passed → OPEN. Add stale records to the verification queue.                    |
| `compliance:rollover`     | On complete                                | Compute next `dueAt` from `rrule`.                                                                                                  |
| `orgs:export`             | OWNER request                              | Build zip, upload to R2, email link.                                                                                                |
| `cleanup:hard-delete`     | Nightly                                    | Hard-delete soft-deleted rows and their R2 objects older than 30 days.                                                              |
| `email:send`, `sms:send`  | From the above                             | Provider calls with retries (5 attempts, exponential backoff). Permanent failures are recorded on the Reminder.                     |

Phase 2 adds `ai:rfp-parse` and `ai:report-draft`.

---

## 11. AI features (Phase 2+)

### 11.1 Ground rules

- **Human in the loop, always.** AI output is a suggestion the user accepts, edits, or discards. Nothing AI-generated is auto-committed: no deadlines, no checklist items, no submitted text.
- **No invented facts.** Drafts may only use facts from the org's profile, selected content blocks, selected data points and the uploaded RFP. Missing facts are written as `[NEEDS: …]` markers, which the UI highlights and counts.
- **Uploaded documents are untrusted input.** Wrap them in clear delimiters, tell the model to treat their contents as data rather than instructions, give the model **no tools** during parsing/drafting, and validate all output with Zod.
- **Privacy:** AI features run only when a user explicitly clicks an AI action. The privacy policy states that document content is sent to Anthropic's API for those actions.
- **Cost control:** log every call in `AiUsage`; monthly per-org quotas by plan (PlatformSetting `AI_MONTHLY_TOKENS_<PLAN>`); a friendly "quota reached" message rather than an error.

### 11.2 Models & API usage

- SDK: `@anthropic-ai/sdk`. Model IDs come from env (`AI_MODEL_DEFAULT`), never hardcoded.
- Default: **`claude-sonnet-5-5`** for parsing, drafting and review (good speed/quality balance, 1M-token context).
- Don't default to `claude-haiku-4-5-20251001`. Its retirement window opens as early as Oct 15, 2026.
- **Structured outputs:** use `client.messages.parse()` with `output_config: { format: zodOutputFormat(Schema) }` (import from `@anthropic-ai/sdk/helpers/zod`). Schema rules from the API:
  - Keep all fields `required`. Use empty strings/arrays rather than optional fields (limit: 24 optional params per request).
  - Use `.nullable()` sparingly (each counts toward a 16 union-type limit).
  - No numeric/string length constraints are enforced by the API (the SDK moves them to descriptions and validates locally).
  - Structured outputs **cannot be combined with citations**, so page references are captured as `sourcePage` fields instead.
  - Handle `stop_reason` of `max_tokens` (retry with a higher limit) and `refusal` (show a friendly error).
- **PDFs:** send as a `document` content block (base64, `media_type: "application/pdf"`) placed **before** the instructions, with `cache_control: { type: "ephemeral" }` so follow-up calls on the same RFP (parse → draft → review) hit the prompt cache. Request limits: 32 MB total and 600 pages (on 1M-context models). Larger files: ask the user to upload just the relevant section.
- **Streaming** for drafting: `client.messages.stream()` relayed to the browser over SSE.
- Docs: platform.claude.com/docs (structured outputs, PDF support, prompt caching).

### 11.3 RFP/NOFO parser (Phase 2)

Flow: upload PDF to the vault (kind `RFP_NOFO`) → "Read this RFP" → `ai:rfp-parse` job → `RfpParse.status = NEEDS_REVIEW` → review screen → user confirms selected fields → applied to the Application.

Extraction schema (`packages/shared/ai/rfp-extraction.ts`):

```ts
import { z } from "zod";

export const RfpExtraction = z.object({
  programTitle: z.string(),
  funderName: z.string(),
  plainSummary: z.string(), // 2–3 sentences, plain language
  deadlines: z.array(
    z.object({
      label: z.string(), // "Full application", "Letter of intent", "Q&A webinar"
      asWritten: z.string(), // exactly as stated in the document
      isoDateTime: z.string().nullable(), // ISO 8601 if determinable, else null
      timezone: z.string().nullable(), // IANA name if stated, else null
      sourcePage: z.number().int(),
    }),
  ),
  eligibility: z.array(z.object({ requirement: z.string(), sourcePage: z.number().int() })),
  awardRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    notes: z.string(),
  }),
  match: z.object({ required: z.boolean(), description: z.string(), sourcePage: z.number().int() }),
  registrationsRequired: z.array(z.string()), // e.g. "SAM.gov", "Grants.gov"
  requiredAttachments: z.array(
    z.object({ name: z.string(), notes: z.string(), sourcePage: z.number().int() }),
  ),
  narrativeSections: z.array(
    z.object({
      heading: z.string(),
      prompt: z.string(),
      limit: z.string(),
      sourcePage: z.number().int(),
    }),
  ),
  scoringCriteria: z.array(
    z.object({
      criterion: z.string(),
      points: z.number().nullable(),
      sourcePage: z.number().int(),
    }),
  ),
  submissionMethod: z.string(),
  formattingRules: z.array(z.string()),
  contacts: z.array(z.object({ name: z.string(), email: z.string(), phone: z.string() })),
  ambiguities: z.array(z.string()), // anything unclear or contradictory, for the user to check
});
```

Review screen: each extracted item has a checkbox, an editable value, and a "page N" link that opens the PDF (pdf.js) at that page. Deadlines require explicit confirmation and show the time zone conversion. Ambiguities are shown as warnings. Registration requirements are checked against the org profile (e.g., SAM required but no UEI → warning).

Evaluation: keep 3–5 public RFPs (federal, state, foundation) in `apps/api/test/fixtures/rfps/` with expected JSON. `pnpm eval:rfp` reports field-level accuracy. Run manually before changing prompts or models (not in CI, since it costs money).

### 11.4 Drafting assistant (Phase 2)

- In an `ApplicationSection`: "Draft with AI" → choose content blocks, data points, tone, and target length (defaults to the section limit) → streamed suggestion → Insert / Replace / Append / Discard.
- System prompt (cached) includes the org profile, the selected boilerplate as voice samples, and the rules: use only provided facts; `[NEEDS: …]` for gaps; respect limits; mirror the funder's scoring language; plain, confident, no exaggeration.
- After generation: show word/char count vs. limit and a list of `[NEEDS]` markers.
- **Review against criteria:** structured output listing each scoring criterion with coverage (`STRONG` / `PARTIAL` / `MISSING`) and one concrete suggestion.

---

## 12. Frontend (app)

### Routes (`/app`)

```
/app                         → redirect to last active org dashboard
/app/sign-in                 → email form, then code entry
/app/onboarding              → create first org
/app/o/:orgSlug              → dashboard
/app/o/:orgSlug/opportunities[/:slug]
/app/o/:orgSlug/applications[/:id]
/app/o/:orgSlug/calendar
/app/o/:orgSlug/compliance
/app/o/:orgSlug/documents
/app/o/:orgSlug/content[/:id]
/app/o/:orgSlug/settings     → profile, members, notifications, export, danger zone
/app/me                      → account, phone, notifications, calendar feed
/app/admin/*                 → curator tools
```

### Design & UX rules

- **Light theme only.** No dark mode, no theme toggle, no `dark:` Tailwind variants. Set `<meta name="color-scheme" content="light">`.
- **Mobile-first.** Every screen is usable at 360px wide. Tap targets ≥ 44px. Bottom tab bar on mobile (Home, Calendar, Applications, More).
- **Plain language.** Explain jargon inline (tooltip/glossary component, see §19). Dates are relative and absolute ("in 6 days · Thu, Mar 12"). Never show raw ISO dates or enum names.
- **Calm, trustworthy visual style:** high contrast (WCAG 2.2 AA), generous spacing, one accent color, status colors that never carry meaning alone (always paired with text/icon).
- **Resilience:** optimistic updates with rollback; offline banner; failed mutations queue a retry toast; forms never lose input on error.
- **Performance budget:** initial SPA JS ≤ 200 KB gzipped; route-level code splitting; no heavy chart/editor libs in the main bundle. Test with Chrome "Slow 4G" throttling.
- **PWA (Phase 1 scope):** installable, app-shell caching via `vite-plugin-pwa`. Offline data entry arrives in Phase 3.
- Empty states always say what to do next and offer a sample/template.

---

## 13. Security & privacy

- Tenant isolation as described in §6, plus the generated isolation test suite (F2).
- Sessions: hashed tokens, httpOnly/Secure/SameSite=Lax, CSRF double-submit, rotation on sign-in.
- Rate limits (`@nestjs/throttler`): auth endpoints, invitations, uploads, public subscribe, AI actions.
- `helmet` with a strict CSP for both SPA and public pages.
- Files: private R2 bucket, short-lived presigned URLs, MIME/size verification, `Content-Disposition: attachment` for non-images.
- Never store SSNs, bank account numbers, or card numbers. Stripe holds payment data (Phase 3).
- Secrets only in Railway env vars. `.env.example` is committed; `.env` is not.
- **Data sovereignty:** orgs own their data; full export any time (F14); no cross-org use of an org's data without explicit opt-in (`aggregateDataConsent`); public dashboards (Phase 4) use only opted-in or already-public data.
- Logs: no document contents, no tokens, emails masked.
- Backups: Railway Postgres backups plus a nightly `pg_dump` to a separate R2 bucket (30-day retention). Restore drill before launch.

---

## 14. Reference data (`packages/shared`)

### Southeast Alaska communities (`SE_COMMUNITIES`)

Angoon, Coffman Cove, Craig, Edna Bay, Elfin Cove, Excursion Inlet, Gustavus, Haines, Hollis, Hoonah, Hydaburg, Hyder, Juneau, Kake, Kasaan, Ketchikan, Klawock, Klukwan, Metlakatla, Meyers Chuck, Naukati Bay, Pelican, Petersburg, Point Baker, Port Alexander, Port Protection, Saxman, Sitka, Skagway, Tenakee Springs, Thorne Bay, Whale Pass, Wrangell, Yakutat, plus regional values: "Prince of Wales Island (regional)", "Southeast Alaska (regional)", "Statewide".

### Focus areas (`FOCUS_AREAS`)

Arts & Culture · Language Revitalization · Education & Youth · Health & Wellness · Behavioral Health · Food Security & Subsistence · Housing · Economic Development & Small Business · Fisheries & Mariculture · Tourism · Environment & Conservation · Outdoor Recreation & Trails · Infrastructure & Energy · Transportation & Harbors · Public Safety & Emergency Preparedness · Community Facilities · Workforce & Training · Elders & Seniors · Broadband & Technology · Historic Preservation

### Seed funders (`packages/db/prisma/seed.ts`)

**Every seeded record ships with `isPublished = false` and `lastVerifiedAt = null`.** The curator verifies details (programs, eligibility, deadlines) before publishing. Names only. Do not invent program details.

| Funder                                                                                               | Type                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------- |
| Rasmuson Foundation                                                                                  | PRIVATE_FOUNDATION     |
| The Alaska Community Foundation (and its local affiliates; curator to confirm which serve Southeast) | COMMUNITY_FOUNDATION   |
| Juneau Community Foundation                                                                          | COMMUNITY_FOUNDATION   |
| M.J. Murdock Charitable Trust                                                                        | PRIVATE_FOUNDATION     |
| Alaska Mental Health Trust Authority                                                                 | STATE                  |
| Alaska Conservation Foundation                                                                       | NONPROFIT_INTERMEDIARY |
| Sealaska Heritage Institute                                                                          | NONPROFIT_INTERMEDIARY |
| Sealaska                                                                                             | ANCSA_CORPORATION      |
| Spruce Root                                                                                          | CDFI_LENDER (verify)   |
| First Alaskans Institute                                                                             | NONPROFIT_INTERMEDIARY |
| Alaska State Council on the Arts                                                                     | STATE                  |
| Alaska Humanities Forum                                                                              | NONPROFIT_INTERMEDIARY |
| Alaska DCCED, Division of Community and Regional Affairs                                             | STATE                  |
| Denali Commission                                                                                    | FEDERAL                |
| USDA Rural Development                                                                               | FEDERAL                |
| U.S. Economic Development Administration                                                             | FEDERAL                |
| NOAA                                                                                                 | FEDERAL                |
| USDA Forest Service                                                                                  | FEDERAL                |
| HHS Administration for Native Americans                                                              | FEDERAL                |
| Bureau of Indian Affairs                                                                             | FEDERAL                |
| City/borough community grant programs (one record per municipality, researched by curator)           | LOCAL_GOVERNMENT       |

### Platform settings (seeded; curator must verify each before launch)

| Key                                              | Seed value                | Note                                                            |
| ------------------------------------------------ | ------------------------- | --------------------------------------------------------------- |
| `SINGLE_AUDIT_THRESHOLD_USD`                     | `1000000`                 | Per 2 CFR 200.501 as revised in 2024. Verify the current value. |
| `VOLUNTEER_HOUR_RATE_USD`                        | _(empty)_                 | Set from Independent Sector's current Alaska figure (Phase 3).  |
| `DEFAULT_INTERNAL_BUFFER_BUSINESS_DAYS`          | `3`                       |                                                                 |
| `OPPORTUNITY_STALE_DAYS`                         | `90`                      |                                                                 |
| `AI_MONTHLY_TOKENS_FREE` / `_PRO` / `_SPONSORED` | TBD                       | Phase 2                                                         |
| `FREE_PLAN_LIMITS`                               | JSON: members, storage GB | TBD (open question)                                             |

---

## 15. Environment variables (`.env.example`)

```
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/segrants
REDIS_URL=redis://localhost:6379
SESSION_SECRET=
CSRF_SECRET=

S3_ENDPOINT=                # Cloudflare R2 endpoint
S3_REGION=auto
S3_BUCKET=
S3_BACKUP_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

POSTMARK_SERVER_TOKEN=
POSTMARK_BROADCAST_STREAM=digest
EMAIL_FROM="Southeast Grants <hello@example.org>"

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=         # or TWILIO_MESSAGING_SERVICE_SID

ANTHROPIC_API_KEY=          # Phase 2
AI_MODEL_DEFAULT=claude-sonnet-5-5

STRIPE_SECRET_KEY=          # Phase 3
STRIPE_WEBHOOK_SECRET=

SENTRY_DSN=
```

Validate all env vars at boot with a Zod schema. Fail fast with a clear message.

---

## 16. Repository layout

```
se-grants/
├─ apps/
│  ├─ api/                         # NestJS
│  │  ├─ src/
│  │  │  ├─ main.ts                # web entry: API + public pages + SPA static
│  │  │  ├─ worker.ts              # BullMQ worker entry
│  │  │  ├─ common/                # config, prisma, guards, decorators, filters, storage, mail, sms, audit
│  │  │  └─ modules/
│  │  │     ├─ auth/  me/  orgs/  members/  documents/  content/
│  │  │     ├─ directory/  applications/  compliance/  calendar/  dashboard/
│  │  │     ├─ reminders/  digest/  public-site/  admin/  export/  webhooks/
│  │  │     └─ ai/ (P2)  awards/ (P3)  billing/ (P3)
│  │  ├─ views/                    # Handlebars templates for public pages
│  │  └─ test/                     # integration tests, fixtures
│  └─ web/                         # React + Vite SPA
│     └─ src/
│        ├─ routes/  features/  components/  lib/  styles/
├─ packages/
│  ├─ db/                          # prisma.config.ts, prisma/schema.prisma, prisma/migrations, prisma/seed.ts,
│  │                               # src/client.ts (exports createPrismaClient + types), generated/ (gitignored)
│  └─ shared/                      # zod DTOs, enums re-exports, constants, date utils, compliance templates, ai schemas
├─ docs/
│  ├─ SPEC.md                      # this file
│  └─ DECISIONS.md                 # running decision log
├─ docker-compose.yml              # postgres + redis for local dev
├─ turbo.json  pnpm-workspace.yaml  .env.example
```

---

## 17. Milestones (Phase 1 build order)

Each milestone ends with: typecheck + lint + tests passing, deployed to a Railway staging environment, and its checklist items in §8 ticked.

| #   | Milestone              | Includes                                                                                                                                           |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0  | Scaffold               | Monorepo, docker-compose, Nest + Vite + Prisma wired, env validation, CI (lint, typecheck, test), Railway staging deploy of a health check, Sentry |
| M1  | Identity & tenancy     | F1, F2, `OrgMemberGuard` + role decorator, audit log, tenant isolation test generator                                                              |
| M2  | Profile & vault        | F3, F4, R2 storage service, upload component with retry/compression                                                                                |
| M3  | Boilerplate            | F5 with autosave + versions                                                                                                                        |
| M4  | Directory              | F6 (curator + org side), seed data, fit labels, deadline display component, F15 admin shell                                                        |
| M5  | Applications           | F8, F13 dashboard                                                                                                                                  |
| M6  | Compliance & reminders | F9, F10 (email, SMS, quiet hours, digest), F7 calendar + ICS                                                                                       |
| M7  | Public site            | F11, F12                                                                                                                                           |
| M8  | Hardening & launch     | F14 export/delete, accessibility pass, performance budget check, security review, backup restore drill, launch checklist below                     |

### Launch checklist

- [ ] Twilio A2P 10DLC registration approved.
- [ ] Postmark sender domain verified (SPF, DKIM, DMARC).
- [ ] Privacy policy and terms published (including AI processing disclosure before Phase 2).
- [ ] Every published funder/opportunity verified by the curator; platform settings verified.
- [ ] Backup restore drill completed.
- [ ] 2–3 pilot orgs onboarded with real deadlines and documents.

---

## 18. Engineering conventions (apply to every change)

- TypeScript `strict`; no `any` (use `unknown` + narrowing). ESLint + Prettier enforced in CI.
- All request/response shapes are Zod schemas in `packages/shared`, imported by both apps. No duplicated types.
- Org-scoped data access goes through services that require `organizationId`. Never query an org-scoped model by `id` alone.
- Import Prisma client and types from the `packages/db` workspace package (`createPrismaClient`, model types). Never import from `@prisma/client` directly (Prisma 7 generates the client into `packages/db/generated`).
- Money: `Decimal` in DB, `string` in JSON, formatted only at render time. Never JS floats for money math (use `decimal.js` if arithmetic is needed).
- Time: store UTC; convert at the edges with `date-fns-tz`; date-only values use `@db.Date` and are treated as calendar dates in the org's time zone.
- Every dated entity change calls `RemindersService.sync(target)`.
- Every security-relevant action calls `AuditService.log(...)`.
- Never edit an applied migration; create a new one. Migration names describe intent.
- Tests ship with features: unit tests for logic (fit scoring, next actions, reminder offsets, compliance rollover, deadline display), integration tests for every endpoint (happy path + permission + isolation), Playwright for sign-in, create org, upload document, create application from opportunity, and receive reminder (mock providers).
- External providers (email, SMS, storage, AI, Stripe) sit behind interfaces with in-memory fakes for tests and local dev.
- UI copy is plain language, sentence case, no enum names or jargon without explanation.
- Light theme only (see §12).
- Adding a dependency? Note it and the reason in `docs/DECISIONS.md`.

---

## 19. Glossary (for UI copy and for Cursor)

| Term                | Meaning                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| RFP / NOFO          | Request for Proposals / Notice of Funding Opportunity: the document describing a grant and how to apply                        |
| LOI                 | Letter of Intent: a short pre-application some funders require                                                                 |
| SAM.gov / UEI       | Federal registration system / the 12-character Unique Entity ID it issues. Required for federal awards and renewed yearly      |
| Assistance Listing  | Federal program number (formerly CFDA)                                                                                         |
| Match / cost share  | Funds or in-kind contributions the applicant must provide alongside the grant                                                  |
| In-kind             | Non-cash contributions (volunteer time, donated goods/space) valued in dollars                                                 |
| Indirect costs      | Overhead (rent, admin) charged to a grant as a rate                                                                            |
| Reimbursement grant | Funder pays after the org spends and submits documentation                                                                     |
| Single Audit        | Federal audit required once federal expenditures in a fiscal year exceed a threshold                                           |
| Fiscal sponsor      | A 501(c)(3) that receives grants on behalf of an unincorporated group                                                          |
| Form 990            | Annual IRS information return for tax-exempt orgs                                                                              |
| ANCSA corporation   | Alaska Native regional or village corporation created under the Alaska Native Claims Settlement Act                            |
| Pick.Click.Give     | Alaska program letting residents donate part of their Permanent Fund Dividend to eligible nonprofits. Orgs must apply annually |

---

## 20. Open questions (for Mitchel)

1. Product name and domain.
2. Pricing: free-tier limits, Pro price, and whether sponsored seats are funded per org or per region.
3. Postmark vs. Resend for email (spec assumes Postmark).
4. Is the curator only Mitchel at launch, or can trusted partners (e.g., Spruce Root staff) suggest/edit opportunities?
5. Should small businesses be fully supported in Phase 1, or soft-launched after nonprofits/tribes?
6. Pilot orgs for M8 (trail association and 1–2 Spruce Root–connected orgs?).
7. Fiscal sponsorship: model the sponsor relationship explicitly in Phase 1, or keep it as a text field (current spec)?

---

## 21. Idea backlog (not scheduled)

- "Busy season" setting: start reminders earlier for deadlines that fall in an org's busy months.
- Grant-writing micro-lessons attached to checklist items ("How to write a need statement").
- Shared regional boilerplate: opt-in library of reusable, citable regional context paragraphs.
- Board report generator: one-page PDF of pipeline, awards, and compliance status for board meetings.
- Funder-side "verified by funder" badge where funders confirm their own listings.
- Training program integration (village residents learning grant writing and software skills).
