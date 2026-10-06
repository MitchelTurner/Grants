import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";
import type { OpportunityStatus, OrgType } from "@se-grants/db";
import {
  displayDeadline,
  fitLabelText,
  FOCUS_AREAS,
  ORG_TYPES,
  orgTypeLabel,
  scoreFit,
  SE_COMMUNITIES,
} from "@se-grants/shared";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WriteService } from "../ai/write.service";

@Injectable()
export class PublicSiteService {
  private readonly layout: Handlebars.TemplateDelegate;

  constructor(
    private readonly prisma: PrismaService,
    private readonly writing: WriteService,
    @Inject(ENV) private readonly env: Env,
  ) {
    const source = readFileSync(resolveView("layout.hbs"), "utf8");
    this.layout = Handlebars.compile(source);
  }

  page(title: string, description: string, body: string, bodyClass = ""): string {
    return this.layout({ title, description, body, bodyClass });
  }

  async home(query: Record<string, string | undefined> = {}): Promise<string> {
    const survey = readSurvey(query);
    const rows = await this.prisma.db.opportunity.findMany({
      where: {
        isPublic: true,
        status: { in: ["OPEN", "UPCOMING"] },
        funder: { isPublished: true },
      },
      include: { funder: true },
      orderBy: { deadlineAt: { sort: "asc", nulls: "last" } },
      take: 200,
    });
    const narrowing = Boolean(survey.orgType || survey.community || survey.focus);
    const shown = rows.flatMap((row) => {
      const note =
        survey.federal === "no" && row.requiresSam
          ? "This one asks for a SAM.gov registration."
          : "";
      if (!narrowing) return [opportunityCard(row, note)];
      if (survey.orgType && survey.community && survey.focus) {
        const fit = scoreFit({
          orgType: survey.orgType,
          community: survey.community,
          servesCommunities: [],
          focusAreas: [survey.focus],
          eligibleOrgTypes: row.eligibleOrgTypes,
          eligibleCommunities: row.eligibleCommunities,
          focusAreasOnOpportunity: row.focusAreas,
        });
        if (fit.label === "not_eligible") return [];
        return [opportunityCard(row, note, fitLabelText(fit.label))];
      }
      if (
        survey.orgType &&
        row.eligibleOrgTypes.length > 0 &&
        !row.eligibleOrgTypes.includes(survey.orgType)
      ) {
        return [];
      }
      if (
        survey.community &&
        row.eligibleCommunities.length > 0 &&
        !row.eligibleCommunities.includes(survey.community)
      ) {
        return [];
      }
      if (survey.focus && row.focusAreas.length > 0 && !row.focusAreas.includes(survey.focus)) {
        return [];
      }
      return [opportunityCard(row, note)];
    });
    const count = narrowing
      ? `${shown.length} match${shown.length === 1 ? "" : "es"} for those answers.`
      : `${shown.length} open or upcoming grant${shown.length === 1 ? "" : "s"}. No account needed.`;
    const empty = narrowing
      ? `<p>No published grant matched those answers. <a href="/">Show every open grant</a></p>`
      : `<p>No opportunities are published yet. A curator checks each record before it appears here.</p>`;
    const body = `
      <div class="catalog">
        <section>
          <h1>Open grants in Southeast Alaska</h1>
          <p>Read what is published now. A short survey on this page can narrow the list. Nothing you answer is saved, and you do not need an account.</p>
          <p class="muted">${count} <a href="#narrow">Narrow this list</a></p>
          <div class="grant-list">
            ${shown.join("") || empty}
          </div>
          <p><a href="/grants">Browse the full directory</a></p>
        </section>
        ${surveyForm(survey)}
      </div>
      <section class="card">
        <h2>Southeast Grants digest</h2>
        <p class="muted">A weekly email of open opportunities. A person reviews it before it goes out. You confirm your address first.</p>
        <form method="post" action="/api/v1/public/digest/subscribe">
          <label>Email <input name="email" type="email" required autocomplete="email" /></label>
          <label>Communities, if you want to narrow it <input name="communities" placeholder="Juneau, Sitka" /></label>
          <label>Focus areas <input name="focusAreas" placeholder="Arts &amp; Culture" /></label>
          <p><button type="submit">Subscribe</button></p>
        </form>
      </section>`;
    return this.page(
      "Southeast Grants",
      "Published grant opportunities for Southeast Alaska. No account required.",
      body,
      "wide",
    );
  }

  async grants(query: Record<string, string | undefined>): Promise<string> {
    const status: OpportunityStatus | { in: OpportunityStatus[] } =
      query.status === "UPCOMING" || query.status === "OPEN"
        ? query.status
        : { in: ["OPEN", "UPCOMING"] };
    const where = {
      isPublic: true,
      status,
      funder: { isPublished: true },
      ...(query.focus ? { focusAreas: { has: query.focus } } : {}),
      ...(query.community ? { eligibleCommunities: { has: query.community } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" as const } } : {}),
    };
    const rows = await this.prisma.db.opportunity.findMany({
      where,
      include: { funder: true },
      orderBy: { deadlineAt: "asc" },
      take: 50,
    });
    const items = rows
      .map((row) => {
        const when = row.deadlineAt
          ? displayDeadline(row.deadlineAt, "America/Juneau", row.deadlineTimezone)
          : null;
        const original = when?.original
          ? ` <span class="chip">${escapeHtml(when.original)}</span>`
          : "";
        return `<article class="card"><h2><a href="/grants/${escapeHtml(row.slug)}">${escapeHtml(row.title)}</a></h2><p>${escapeHtml(row.summary)}</p><p class="muted">${escapeHtml(row.funder.name)}${when ? ` · ${escapeHtml(when.primary)}` : ""}${original}</p></article>`;
      })
      .join("");
    const body = `
      <h1>Grants</h1>
      <form method="get" action="/grants">
        <label>Search <input name="q" value="${escapeHtml(query.q ?? "")}" /></label>
        <label>Community <input name="community" value="${escapeHtml(query.community ?? "")}" /></label>
        <label>Focus <input name="focus" value="${escapeHtml(query.focus ?? "")}" /></label>
        <label>Status
          <select name="status">
            <option value="">Open and upcoming</option>
            <option value="OPEN" ${query.status === "OPEN" ? "selected" : ""}>Open</option>
            <option value="UPCOMING" ${query.status === "UPCOMING" ? "selected" : ""}>Upcoming</option>
          </select>
        </label>
        <p><button type="submit">Filter</button></p>
      </form>
      ${items || "<p>No published opportunities match those filters yet.</p>"}`;
    return this.page(
      "Grants · Southeast Grants",
      "Published grant opportunities for Southeast Alaska.",
      body,
    );
  }

  async grant(slug: string): Promise<string | null> {
    const row = await this.prisma.db.opportunity.findUnique({
      where: { slug },
      include: { funder: true },
    });
    if (
      !row ||
      !row.isPublic ||
      row.status === "DRAFT" ||
      row.status === "ARCHIVED" ||
      !row.funder.isPublished
    ) {
      return null;
    }
    const when = row.deadlineAt
      ? displayDeadline(row.deadlineAt, "America/Juneau", row.deadlineTimezone)
      : null;
    const verified = row.lastVerifiedAt ? row.lastVerifiedAt.toISOString().slice(0, 10) : "not yet";
    const caution = row.lastVerifiedAt
      ? ""
      : "<p>This record has not been verified recently. Check the funder's site before you rely on it.</p>";
    const body = `
      <h1>${escapeHtml(row.title)}</h1>
      <p>${escapeHtml(row.summary)}</p>
      <p>Funder: <a href="/funders/${escapeHtml(row.funder.slug)}">${escapeHtml(row.funder.name)}</a></p>
      ${when ? `<p>${escapeHtml(when.primary)}${when.original ? ` <span class="chip">${escapeHtml(when.original)}</span>` : ""}</p>` : ""}
      <p class="muted">Last verified: ${escapeHtml(verified)}</p>
      ${caution}
      <p><a class="button" href="/app/sign-in">Track this in your workspace</a></p>`;
    return this.page(`${row.title} · Southeast Grants`, row.summary.slice(0, 160), body);
  }

  async funders(): Promise<string> {
    const rows = await this.prisma.db.funder.findMany({
      where: { isPublished: true },
      orderBy: { name: "asc" },
    });
    const items = rows
      .map(
        (row) => `<li><a href="/funders/${escapeHtml(row.slug)}">${escapeHtml(row.name)}</a></li>`,
      )
      .join("");
    return this.page(
      "Funders · Southeast Grants",
      "Funders who support work in Southeast Alaska.",
      `<h1>Funders</h1><ul>${items || "<li>None published yet.</li>"}</ul>`,
    );
  }

  async funder(slug: string): Promise<string | null> {
    const row = await this.prisma.db.funder.findUnique({ where: { slug } });
    if (!row || !row.isPublished) return null;
    const verified = row.lastVerifiedAt ? row.lastVerifiedAt.toISOString().slice(0, 10) : "not yet";
    const awards = await this.writing.pastAwardsForPublicFunder(slug);
    const awardList = awards
      .map(
        (award) =>
          `<li>${escapeHtml(String(award.year))} · ${escapeHtml(award.recipientName)} · ${escapeHtml(award.community)} · ${escapeHtml(award.amount ?? "")} · ${escapeHtml(award.purpose)} · <a href="${escapeHtml(award.sourceUrl)}">Source</a></li>`,
      )
      .join("");
    const body = `<h1>${escapeHtml(row.name)}</h1><p>${escapeHtml(row.description ?? "")}</p><p class="muted">Last verified: ${escapeHtml(verified)}</p>${
      awardList ? `<h2>Past awards on record</h2><ul>${awardList}</ul>` : ""
    }<p><a class="button" href="/app/sign-in">Track this in your workspace</a></p>`;
    return this.page(
      `${row.name} · Southeast Grants`,
      row.description?.slice(0, 160) ?? row.name,
      body,
    );
  }

  about(): string {
    return this.page(
      "About · Southeast Grants",
      "Who Southeast Grants is for.",
      `<h1>About</h1><p>Small organizations in Southeast Alaska compete for grants with almost no staff. This workspace keeps deadlines, documents, and writing with the organization when people change.</p><p>A curator checks funder records and marks the date they were last verified. Draft notes stay private.</p>`,
    );
  }

  privacy(): string {
    return this.page(
      "Privacy · Southeast Grants",
      "How Southeast Grants handles organization data.",
      `<h1>Privacy</h1><p>Your organization owns its documents, writing, and applications. Owners can export everything or delete the organization. We do not use one organization's files to help another unless that organization opts in.</p><p>AI features run only when someone clicks an AI action. The document or draft is sent to Anthropic for that action. A person reviews the result before it is saved. Nothing the assistant writes is filed as a deadline, checklist item, or submitted answer on its own.</p><p>Sign-in emails contain a link and a short code. We store only a hash of the session token.</p><p>Card numbers are not stored here. Stripe holds payment details when an organization pays for Pro.</p>`,
    );
  }

  terms(): string {
    return this.page(
      "Terms · Southeast Grants",
      "Terms for using Southeast Grants.",
      `<h1>Terms</h1><p>Southeast Grants helps you track opportunities and deadlines. It does not submit applications for you, and it does not pay grantees. Check every deadline on the funder's own site before you rely on it.</p><p>You are responsible for the accuracy of what you upload and for who you invite into your organization.</p>`,
    );
  }

  robots(): string {
    const origin = this.env.APP_URL.replace(/\/$/, "");
    return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
  }

  async sitemap(): Promise<string> {
    const [grants, funders] = await Promise.all([
      this.prisma.db.opportunity.findMany({
        where: {
          isPublic: true,
          status: { in: ["OPEN", "UPCOMING", "CLOSED"] },
          funder: { isPublished: true },
        },
        select: { slug: true },
      }),
      this.prisma.db.funder.findMany({ where: { isPublished: true }, select: { slug: true } }),
    ]);
    const urls = [
      "/",
      "/grants",
      "/funders",
      "/about",
      "/privacy",
      "/terms",
      "/quiz",
      ...grants.map((row) => `/grants/${row.slug}`),
      ...funders.map((row) => `/funders/${row.slug}`),
    ];
    const origin = this.env.APP_URL.replace(/\/$/, "");
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${origin}${url}</loc></url>`).join("")}</urlset>`;
  }
}

function resolveView(name: string): string {
  const candidates = [
    join(__dirname, "../../views", name),
    join(process.cwd(), "src/views", name),
    join(process.cwd(), "apps/api/src/views", name),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Missing view ${name}`);
  return found;
}

type PublicOpportunity = {
  title: string;
  slug: string;
  summary: string;
  status: OpportunityStatus;
  focusAreas: string[];
  deadlineAt: Date | null;
  deadlineTimezone: string | null;
  requiresSam: boolean;
  funder: { name: string };
};

type SurveyAnswers = {
  orgType?: OrgType;
  community?: string;
  focus?: string;
  federal?: "yes" | "no";
};

function readSurvey(query: Record<string, string | undefined>): SurveyAnswers {
  const orgType = ORG_TYPES.find((type) => type === query.orgType);
  const focus = FOCUS_AREAS.find((area) => area === query.focus);
  const community = query.community?.trim().slice(0, 120) || undefined;
  const federal = query.federal === "yes" || query.federal === "no" ? query.federal : undefined;
  return { orgType, focus, community, federal };
}

function surveyForm(survey: SurveyAnswers): string {
  const types = ORG_TYPES.map(
    (type) =>
      `<option value="${type}" ${survey.orgType === type ? "selected" : ""}>${escapeHtml(orgTypeLabel(type))}</option>`,
  ).join("");
  const communities = communityOptions(survey.community);
  const focuses = FOCUS_AREAS.map(
    (area) =>
      `<option value="${escapeHtml(area)}" ${survey.focus === area ? "selected" : ""}>${escapeHtml(area)}</option>`,
  ).join("");
  return `<aside class="card survey" id="narrow">
      <h2>Narrow this list</h2>
      <p class="muted">Answer any of these. The list updates on this page. Answers are not saved.</p>
      <form method="get" action="/">
        <label>Organization type
          <select name="orgType">
            <option value="">Any</option>
            ${types}
          </select>
        </label>
        <label>Community
          <select name="community">
            <option value="">Any</option>
            ${communities}
          </select>
        </label>
        <label>Focus
          <select name="focus">
            <option value="">Any</option>
            ${focuses}
          </select>
        </label>
        <label>Already receiving federal funds?
          <select name="federal">
            <option value="">Not sure</option>
            <option value="yes" ${survey.federal === "yes" ? "selected" : ""}>Yes</option>
            <option value="no" ${survey.federal === "no" ? "selected" : ""}>No</option>
          </select>
        </label>
        <p class="actions"><button type="submit">Show matches</button> <a class="button button-quiet" href="/">Show every open grant</a></p>
      </form>
    </aside>`;
}

function communityOptions(selected: string | undefined): string {
  const known = SE_COMMUNITIES.includes(selected as (typeof SE_COMMUNITIES)[number]);
  const extra =
    selected && !known
      ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`
      : "";
  const options = SE_COMMUNITIES.map(
    (community) =>
      `<option value="${escapeHtml(community)}" ${selected === community ? "selected" : ""}>${escapeHtml(community)}</option>`,
  ).join("");
  return extra + options;
}

function opportunityCard(row: PublicOpportunity, federalNote: string, fit?: string): string {
  const when = row.deadlineAt
    ? displayDeadline(row.deadlineAt, "America/Juneau", row.deadlineTimezone)
    : null;
  const chips = [row.status === "UPCOMING" ? "Upcoming" : "Open", ...row.focusAreas.slice(0, 3)]
    .map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`)
    .join("");
  const deadline = when
    ? `${escapeHtml(when.primary)}${when.original ? ` <span class="chip">${escapeHtml(when.original)}</span>` : ""}`
    : "No fixed deadline";
  return `<article class="card grant-card">
      <h2><a href="/grants/${escapeHtml(row.slug)}">${escapeHtml(row.title)}</a></h2>
      <p class="muted">${escapeHtml(row.funder.name)} · ${deadline}</p>
      <p>${escapeHtml(row.summary)}</p>
      ${fit ? `<p>${escapeHtml(fit)}</p>` : ""}
      ${federalNote ? `<p>${escapeHtml(federalNote)}</p>` : ""}
      <div class="chips">${chips}</div>
    </article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
