import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  compareMoney,
  defaultDeadlineZone,
  displayDeadline,
  fitLabelText,
  isValidTimeZone,
  scoreFit,
  slugify,
  type DeadlineType,
  type FunderType,
  type FundingForm,
  type OpportunityStatus,
  type OrgType,
} from "@se-grants/shared";
import { cursorFilter, encodeCursor } from "../../common/http/pagination";
import { iso, moneyOut } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RemindersService } from "../reminders/reminders.service";

type FunderInput = {
  name: string;
  type: FunderType;
  website?: string | null;
  description?: string | null;
  geographicFocus?: string[];
  focusAreas?: string[];
  eligibleOrgTypes?: OrgType[];
  curatorNotes?: string | null;
  isPublished?: boolean;
};

type OpportunityInput = {
  funderId: string;
  title: string;
  summary: string;
  url?: string | null;
  fundingForm?: FundingForm;
  eligibleOrgTypes?: OrgType[];
  eligibleCommunities?: string[];
  focusAreas?: string[];
  minAmount?: string | null;
  maxAmount?: string | null;
  matchRequired?: boolean;
  matchNotes?: string | null;
  deadlineType: DeadlineType;
  deadlineAt?: string | null;
  deadlineTimezone?: string | null;
  loiDeadlineAt?: string | null;
  opensAt?: string | null;
  recurrenceNote?: string | null;
  assistanceListing?: string | null;
  requiresSam?: boolean;
  status?: OpportunityStatus;
  isPublic?: boolean;
  curatorNotes?: string | null;
};

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
  ) {}

  async createFunder(input: FunderInput) {
    const funder = await this.prisma.db.funder.create({
      data: {
        ...input,
        slug: await this.unique("funder", input.name),
        geographicFocus: input.geographicFocus ?? [],
        focusAreas: input.focusAreas ?? [],
        eligibleOrgTypes: input.eligibleOrgTypes ?? [],
      },
    });
    return this.funderDto(funder, true);
  }

  async updateFunder(id: string, input: Partial<FunderInput>) {
    const current = await this.prisma.db.funder.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("That funder was not found.");
    const funder = await this.prisma.db.funder.update({ where: { id }, data: input });
    return this.funderDto(funder, true);
  }

  async listFunders(admin: boolean, cursor?: string, limit = 25) {
    const rows = await this.prisma.db.funder.findMany({
      where: { ...(admin ? {} : { isPublished: true }), ...(cursorFilter(cursor) ?? {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.funderDto(row, admin)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async funderBySlug(slug: string, admin: boolean) {
    const funder = await this.prisma.db.funder.findUnique({ where: { slug } });
    if (!funder || (!admin && !funder.isPublished)) {
      throw new NotFoundException("That funder was not found.");
    }
    return this.funderDto(funder, admin);
  }

  async createOpportunity(input: OpportunityInput) {
    const funder = await this.prisma.db.funder.findUnique({ where: { id: input.funderId } });
    if (!funder) throw new NotFoundException("That funder was not found.");
    this.assertZone(input.deadlineTimezone);
    const opportunity = await this.prisma.db.opportunity.create({
      data: {
        funderId: funder.id,
        title: input.title,
        summary: input.summary,
        deadlineType: input.deadlineType,
        slug: await this.unique("opportunity", input.title),
        url: input.url,
        fundingForm: input.fundingForm,
        eligibleOrgTypes: input.eligibleOrgTypes ?? [],
        eligibleCommunities: input.eligibleCommunities ?? [],
        focusAreas: input.focusAreas ?? [],
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        matchRequired: input.matchRequired,
        matchNotes: input.matchNotes,
        deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
        deadlineTimezone: input.deadlineTimezone || defaultDeadlineZone(funder.type),
        loiDeadlineAt: input.loiDeadlineAt ? new Date(input.loiDeadlineAt) : null,
        opensAt: input.opensAt ? new Date(input.opensAt) : null,
        recurrenceNote: input.recurrenceNote,
        assistanceListing: input.assistanceListing,
        requiresSam: input.requiresSam,
        status: input.status,
        isPublic: input.isPublic,
        curatorNotes: input.curatorNotes,
      },
    });
    return this.opportunityDto(
      opportunity,
      funder,
      true,
      null,
      "America/Juneau",
      await this.staleDays(),
    );
  }

  async updateOpportunity(id: string, input: Partial<OpportunityInput>) {
    const current = await this.prisma.db.opportunity.findUnique({
      where: { id },
      include: { funder: true },
    });
    if (!current) throw new NotFoundException("That opportunity was not found.");
    this.assertZone(input.deadlineTimezone);
    const opportunity = await this.prisma.db.opportunity.update({
      where: { id },
      data: this.opportunityData(input, current.funder.type),
    });
    const watches = await this.prisma.db.opportunityWatch.findMany({
      where: { opportunityId: id },
    });
    for (const watch of watches) {
      await this.reminders.syncWatch(watch.organizationId, id);
    }
    return this.opportunityDto(
      opportunity,
      current.funder,
      true,
      null,
      "America/Juneau",
      await this.staleDays(),
    );
  }

  async verifyOpportunity(id: string, userId: string) {
    const opportunity = await this.prisma.db.opportunity.update({
      where: { id },
      data: { lastVerifiedAt: new Date(), verifiedById: userId },
      include: { funder: true },
    });
    return this.opportunityDto(
      opportunity,
      opportunity.funder,
      true,
      null,
      "America/Juneau",
      await this.staleDays(),
    );
  }

  async verifyFunder(id: string, userId: string) {
    const funder = await this.prisma.db.funder.update({
      where: { id },
      data: { lastVerifiedAt: new Date(), verifiedById: userId },
    });
    return this.funderDto(funder, true);
  }

  async listOpportunities(options: {
    admin: boolean;
    viewerTimeZone: string;
    query: {
      q?: string;
      funderType?: FunderType;
      fundingForm?: FundingForm;
      focusArea?: string;
      community?: string;
      status?: "OPEN" | "UPCOMING";
      minAmount?: string;
      maxAmount?: string;
      deadlineWithinDays?: number;
      fitForOrgId?: string;
      cursor?: string;
      limit?: number;
    };
    memberOrgIds: string[];
  }) {
    const limit = options.query.limit ?? 25;
    const deadlineBefore = options.query.deadlineWithinDays
      ? new Date(Date.now() + options.query.deadlineWithinDays * 86_400_000)
      : undefined;
    const and: object[] = [];
    const cursor = cursorFilter(options.query.cursor);
    if (cursor) and.push(cursor);
    if (options.query.q) {
      and.push({
        OR: [
          { title: { contains: options.query.q, mode: "insensitive" } },
          { summary: { contains: options.query.q, mode: "insensitive" } },
        ],
      });
    }
    const rows = await this.prisma.db.opportunity.findMany({
      where: {
        ...(options.admin
          ? {}
          : {
              isPublic: true,
              status: { in: ["OPEN", "UPCOMING", "CLOSED"] },
              funder: { isPublished: true },
            }),
        ...(options.query.status ? { status: options.query.status } : {}),
        ...(options.query.fundingForm ? { fundingForm: options.query.fundingForm } : {}),
        ...(options.query.focusArea ? { focusAreas: { has: options.query.focusArea } } : {}),
        ...(options.query.community
          ? { eligibleCommunities: { has: options.query.community } }
          : {}),
        ...(options.query.funderType
          ? {
              funder: {
                type: options.query.funderType,
                ...(options.admin ? {} : { isPublished: true }),
              },
            }
          : {}),
        ...(deadlineBefore ? { deadlineAt: { lte: deadlineBefore, gte: new Date() } } : {}),
        ...(and.length > 0 ? { AND: and } : {}),
      },
      include: { funder: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    let filtered = rows;
    const minAmount = options.query.minAmount;
    const maxAmount = options.query.maxAmount;
    if (minAmount) {
      filtered = filtered.filter(
        (row) => row.maxAmount == null || compareMoney(row.maxAmount.toString(), minAmount) >= 0,
      );
    }
    if (maxAmount) {
      filtered = filtered.filter(
        (row) => row.minAmount == null || compareMoney(row.minAmount.toString(), maxAmount) <= 0,
      );
    }
    const org = options.query.fitForOrgId
      ? await this.fitOrg(options.query.fitForOrgId, options.memberOrgIds)
      : null;
    const page = filtered.slice(0, limit);
    const last = page.at(-1);
    const staleDays = await this.staleDays();
    return {
      items: page.map((row) =>
        this.opportunityDto(row, row.funder, options.admin, org, options.viewerTimeZone, staleDays),
      ),
      nextCursor: filtered.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async opportunityBySlug(
    slug: string,
    admin: boolean,
    viewerTimeZone: string,
    fitForOrgId?: string,
    memberOrgIds: string[] = [],
  ) {
    const row = await this.prisma.db.opportunity.findUnique({
      where: { slug },
      include: { funder: true },
    });
    if (
      !row ||
      (!admin &&
        (!row.isPublic ||
          row.status === "DRAFT" ||
          row.status === "ARCHIVED" ||
          !row.funder.isPublished))
    ) {
      throw new NotFoundException("That opportunity was not found.");
    }
    const org = fitForOrgId ? await this.fitOrg(fitForOrgId, memberOrgIds) : null;
    return this.opportunityDto(row, row.funder, admin, org, viewerTimeZone, await this.staleDays());
  }

  async watch(orgId: string, opportunityId: string) {
    const opportunity = await this.prisma.db.opportunity.findFirst({
      where: { id: opportunityId, isPublic: true, status: { notIn: ["DRAFT", "ARCHIVED"] } },
    });
    if (!opportunity) throw new NotFoundException("That opportunity was not found.");
    await this.prisma.db.opportunityWatch.upsert({
      where: { organizationId_opportunityId: { organizationId: orgId, opportunityId } },
      create: { organizationId: orgId, opportunityId },
      update: {},
    });
    await this.reminders.syncWatch(orgId, opportunityId);
    return { watching: true };
  }

  async unwatch(orgId: string, opportunityId: string) {
    await this.prisma.db.opportunityWatch.deleteMany({
      where: { organizationId: orgId, opportunityId },
    });
    await this.reminders.syncWatch(orgId, opportunityId);
    return { watching: false };
  }

  async verificationQueue() {
    const days = await this.staleDays();
    const before = new Date(Date.now() - days * 86_400_000);
    const stale = { OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: before } }] };
    const [opportunities, funders] = await Promise.all([
      this.prisma.db.opportunity.findMany({
        where: { status: { not: "ARCHIVED" }, ...stale },
        include: { funder: true },
        take: 100,
        orderBy: { updatedAt: "asc" },
      }),
      this.prisma.db.funder.findMany({ where: stale, take: 100, orderBy: { updatedAt: "asc" } }),
    ]);
    return {
      opportunities: opportunities.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        lastVerifiedAt: iso(row.lastVerifiedAt),
      })),
      funders: funders.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        lastVerifiedAt: iso(row.lastVerifiedAt),
      })),
    };
  }

  async importCsv(csv: string, dryRun: boolean) {
    const lines = csv.trim().split(/\r?\n/);
    const header =
      lines
        .shift()
        ?.split(",")
        .map((cell) => cell.trim()) ?? [];
    const required = ["funderSlug", "title", "summary", "deadlineType"];
    for (const column of required) {
      if (!header.includes(column)) {
        throw new BadRequestException(`The CSV needs a ${column} column.`);
      }
    }
    const preview: {
      line: number;
      action: "create" | "error";
      message?: string;
      title?: string;
    }[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!line.trim()) continue;
      const cells = splitCsv(line);
      const record = Object.fromEntries(header.map((key, cell) => [key, cells[cell] ?? ""]));
      const funder = await this.prisma.db.funder.findUnique({
        where: { slug: record.funderSlug ?? "" },
      });
      if (!funder || !record.title || !record.summary || !record.deadlineType) {
        preview.push({
          line: index + 2,
          action: "error",
          message: "Check the funder slug, title, summary, and deadline type.",
        });
        continue;
      }
      preview.push({ line: index + 2, action: "create", title: record.title });
      if (!dryRun) {
        await this.createOpportunity({
          funderId: funder.id,
          title: record.title,
          summary: record.summary,
          deadlineType: record.deadlineType as DeadlineType,
          fundingForm: (record.fundingForm || "GRANT") as FundingForm,
          deadlineAt: record.deadlineAt || null,
          deadlineTimezone: record.deadlineTimezone || null,
          status: (record.status || "DRAFT") as OpportunityStatus,
          url: record.url || null,
          minAmount: record.minAmount || null,
          maxAmount: record.maxAmount || null,
          focusAreas: record.focusAreas
            ? (record.focusAreas.split("|") as OpportunityInput["focusAreas"])
            : [],
          eligibleOrgTypes: record.eligibleOrgTypes
            ? (record.eligibleOrgTypes.split("|") as OrgType[])
            : [],
          requiresSam: record.requiresSam === "true",
          isPublic: record.isPublic !== "false",
        });
      }
    }
    return { dryRun, rows: preview };
  }

  async runLifecycle(): Promise<void> {
    const now = new Date();
    await this.prisma.db.opportunity.updateMany({
      where: { status: "OPEN", deadlineType: "FIXED", deadlineAt: { lt: now } },
      data: { status: "CLOSED" },
    });
    await this.prisma.db.opportunity.updateMany({
      where: { status: "UPCOMING", opensAt: { lte: now } },
      data: { status: "OPEN" },
    });
  }

  private async fitOrg(orgId: string, memberOrgIds: string[]) {
    if (!memberOrgIds.includes(orgId)) {
      throw new NotFoundException("That organization was not found.");
    }
    const org = await this.prisma.db.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) throw new NotFoundException("That organization was not found.");
    const sam = await this.prisma.db.complianceItem.findFirst({
      where: { organizationId: orgId, kind: "SAM_REGISTRATION", isActive: true },
      orderBy: { dueAt: "asc" },
    });
    return org ? { ...org, samDueAt: sam?.dueAt ?? null } : null;
  }

  private async staleDays(): Promise<number> {
    const setting = await this.prisma.db.platformSetting.findUnique({
      where: { key: "OPPORTUNITY_STALE_DAYS" },
    });
    const parsed = Number(setting?.value ?? "90");
    return Number.isFinite(parsed) ? parsed : 90;
  }

  private opportunityData(input: Partial<OpportunityInput>, funderType: FunderType) {
    const zone =
      input.deadlineTimezone === undefined
        ? undefined
        : input.deadlineTimezone || defaultDeadlineZone(funderType);
    return {
      title: input.title,
      summary: input.summary,
      url: input.url,
      fundingForm: input.fundingForm,
      eligibleOrgTypes: input.eligibleOrgTypes,
      eligibleCommunities: input.eligibleCommunities,
      focusAreas: input.focusAreas,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      matchRequired: input.matchRequired,
      matchNotes: input.matchNotes,
      deadlineType: input.deadlineType,
      deadlineAt:
        input.deadlineAt === undefined
          ? undefined
          : input.deadlineAt
            ? new Date(input.deadlineAt)
            : null,
      deadlineTimezone: zone,
      loiDeadlineAt:
        input.loiDeadlineAt === undefined
          ? undefined
          : input.loiDeadlineAt
            ? new Date(input.loiDeadlineAt)
            : null,
      opensAt:
        input.opensAt === undefined ? undefined : input.opensAt ? new Date(input.opensAt) : null,
      recurrenceNote: input.recurrenceNote,
      assistanceListing: input.assistanceListing,
      requiresSam: input.requiresSam,
      status: input.status,
      isPublic: input.isPublic,
      curatorNotes: input.curatorNotes,
    };
  }

  private funderDto(
    funder: {
      id: string;
      name: string;
      slug: string;
      type: FunderType;
      website: string | null;
      description: string | null;
      geographicFocus: string[];
      focusAreas: string[];
      eligibleOrgTypes: OrgType[];
      curatorNotes: string | null;
      isPublished: boolean;
      lastVerifiedAt: Date | null;
    },
    admin: boolean,
  ) {
    return {
      id: funder.id,
      name: funder.name,
      slug: funder.slug,
      type: funder.type,
      website: funder.website,
      description: funder.description,
      geographicFocus: funder.geographicFocus,
      focusAreas: funder.focusAreas,
      eligibleOrgTypes: funder.eligibleOrgTypes,
      isPublished: funder.isPublished,
      lastVerifiedAt: iso(funder.lastVerifiedAt),
      curatorNotes: admin ? funder.curatorNotes : undefined,
    };
  }

  private opportunityDto(
    row: {
      id: string;
      slug: string;
      title: string;
      summary: string;
      url: string | null;
      fundingForm: FundingForm;
      eligibleOrgTypes: OrgType[];
      eligibleCommunities: string[];
      focusAreas: string[];
      minAmount: { toString(): string } | null;
      maxAmount: { toString(): string } | null;
      matchRequired: boolean;
      matchNotes: string | null;
      deadlineType: DeadlineType;
      deadlineAt: Date | null;
      deadlineTimezone: string | null;
      loiDeadlineAt: Date | null;
      opensAt: Date | null;
      recurrenceNote: string | null;
      assistanceListing: string | null;
      requiresSam: boolean;
      status: OpportunityStatus;
      isPublic: boolean;
      curatorNotes: string | null;
      lastVerifiedAt: Date | null;
      funderId: string;
    },
    funder: { name: string; slug: string; type: FunderType; isPublished: boolean },
    admin: boolean,
    org: {
      type: OrgType;
      community: string;
      servesCommunities: string[];
      focusAreas: string[];
      uei: string | null;
      samDueAt: Date | null;
    } | null,
    viewerTimeZone: string,
    staleDays: number,
  ) {
    const deadline = row.deadlineAt
      ? displayDeadline(row.deadlineAt, viewerTimeZone, row.deadlineTimezone)
      : null;
    const stale =
      !row.lastVerifiedAt || Date.now() - row.lastVerifiedAt.getTime() > staleDays * 86_400_000;
    const fit = org
      ? scoreFit({
          orgType: org.type,
          community: org.community,
          servesCommunities: org.servesCommunities,
          focusAreas: org.focusAreas,
          eligibleOrgTypes: row.eligibleOrgTypes,
          eligibleCommunities: row.eligibleCommunities,
          focusAreasOnOpportunity: row.focusAreas,
        })
      : null;
    let samWarning: string | null = null;
    if (row.requiresSam && org) {
      const expiresBefore =
        org.samDueAt && row.deadlineAt ? org.samDueAt.getTime() < row.deadlineAt.getTime() : false;
      if (!org.uei || expiresBefore) {
        samWarning =
          "This requires an active SAM.gov registration. Registration can take several weeks. Start now.";
      }
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      url: row.url,
      fundingForm: row.fundingForm,
      eligibleOrgTypes: row.eligibleOrgTypes,
      eligibleCommunities: row.eligibleCommunities,
      focusAreas: row.focusAreas,
      minAmount: moneyOut(row.minAmount),
      maxAmount: moneyOut(row.maxAmount),
      matchRequired: row.matchRequired,
      matchNotes: row.matchNotes,
      deadlineType: row.deadlineType,
      deadlineAt: iso(row.deadlineAt),
      deadlineTimezone: row.deadlineTimezone,
      deadline: deadline
        ? {
            primary: deadline.primary,
            original: deadline.original,
            timezonesDiffer: deadline.timezonesDiffer,
          }
        : null,
      loiDeadlineAt: iso(row.loiDeadlineAt),
      opensAt: iso(row.opensAt),
      recurrenceNote: row.recurrenceNote,
      assistanceListing: row.assistanceListing,
      requiresSam: row.requiresSam,
      status: row.status,
      isPublic: row.isPublic,
      lastVerifiedAt: iso(row.lastVerifiedAt),
      stale,
      caution: stale
        ? "This record has not been verified recently. Check the funder's site before you rely on it."
        : null,
      samWarning,
      fit: fit ? { ...fit, text: fitLabelText(fit.label) } : null,
      funder: { id: row.funderId, name: funder.name, slug: funder.slug, type: funder.type },
      curatorNotes: admin ? row.curatorNotes : undefined,
    };
  }

  private assertZone(zone: string | null | undefined) {
    if (zone && !isValidTimeZone(zone)) {
      throw new BadRequestException("Choose a time zone from the list.");
    }
  }

  private async unique(kind: "funder" | "opportunity", name: string) {
    const base = slugify(name);
    let slug = base;
    let n = 2;
    while (
      kind === "funder"
        ? await this.prisma.db.funder.findUnique({ where: { slug } })
        : await this.prisma.db.opportunity.findUnique({ where: { slug } })
    ) {
      slug = `${base.slice(0, 48)}-${n}`;
      n += 1;
    }
    return slug;
  }
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}
