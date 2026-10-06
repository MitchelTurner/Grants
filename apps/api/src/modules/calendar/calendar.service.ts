import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";

export type CalendarEvent = {
  id: string;
  kind: "opportunity" | "application" | "checklist" | "compliance" | "document";
  title: string;
  at: string;
  href: string;
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async forOrg(orgId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const org = await this.prisma.db.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) return [];
    return this.collect([org], from, to);
  }

  async feedForUser(userId: string): Promise<string> {
    const memberships = await this.prisma.db.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: true },
    });
    const from = new Date(Date.now() - 30 * 86_400_000);
    const to = new Date(Date.now() + 365 * 86_400_000);
    const events = await this.collect(
      memberships.map((row) => row.organization),
      from,
      to,
    );
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Southeast Grants//EN",
      "CALSCALE:GREGORIAN",
    ];
    for (const event of events) {
      const stamp = icsDate(new Date(event.at));
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}@southeast-grants`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${stamp}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `URL:${this.env.APP_URL}${event.href}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  private async collect(
    orgs: { id: string; slug: string }[],
    from: Date,
    to: Date,
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const orgIds = orgs.map((org) => org.id);
    const slug = new Map(orgs.map((org) => [org.id, org.slug]));
    const watches = await this.prisma.db.opportunityWatch.findMany({
      where: {
        organizationId: { in: orgIds },
        opportunity: { deadlineAt: { gte: from, lte: to } },
      },
      include: { opportunity: true },
    });
    for (const watch of watches) {
      if (!watch.opportunity.deadlineAt) continue;
      events.push({
        id: `opportunity-${watch.id}`,
        kind: "opportunity",
        title: watch.opportunity.title,
        at: watch.opportunity.deadlineAt.toISOString(),
        href: `/app/o/${slug.get(watch.organizationId)}/opportunities/${watch.opportunity.slug}`,
      });
    }
    const applications = await this.prisma.db.application.findMany({
      where: { organizationId: { in: orgIds }, deletedAt: null },
      include: { checklist: true },
    });
    for (const application of applications) {
      const orgSlug = slug.get(application.organizationId);
      for (const due of [application.funderDeadlineAt, application.internalDueAt]) {
        if (due && due >= from && due <= to) {
          events.push({
            id: `application-${application.id}-${due.toISOString()}`,
            kind: "application",
            title: application.title,
            at: due.toISOString(),
            href: `/app/o/${orgSlug}/applications/${application.id}`,
          });
        }
      }
      for (const item of application.checklist) {
        if (item.dueAt && item.dueAt >= from && item.dueAt <= to) {
          events.push({
            id: `checklist-${item.id}`,
            kind: "checklist",
            title: item.label,
            at: item.dueAt.toISOString(),
            href: `/app/o/${orgSlug}/applications/${application.id}`,
          });
        }
      }
    }
    const compliance = await this.prisma.db.complianceItem.findMany({
      where: { organizationId: { in: orgIds }, isActive: true, dueAt: { gte: from, lte: to } },
    });
    for (const item of compliance) {
      events.push({
        id: `compliance-${item.id}`,
        kind: "compliance",
        title: item.title,
        at: item.dueAt.toISOString(),
        href: `/app/o/${slug.get(item.organizationId)}/compliance`,
      });
    }
    const documents = await this.prisma.db.document.findMany({
      where: { organizationId: { in: orgIds }, deletedAt: null, expiresAt: { gte: from, lte: to } },
    });
    for (const document of documents) {
      if (!document.expiresAt) continue;
      events.push({
        id: `document-${document.id}`,
        kind: "document",
        title: document.title,
        at: document.expiresAt.toISOString(),
        href: `/app/o/${slug.get(document.organizationId)}/documents`,
      });
    }
    return events.sort((left, right) => left.at.localeCompare(right.at));
  }
}

function icsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}
