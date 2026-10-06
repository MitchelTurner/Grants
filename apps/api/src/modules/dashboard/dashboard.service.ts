import { Injectable } from "@nestjs/common";
import {
  packetMissing,
  profileCompleteness,
  rankNextActions,
  type NextAction,
} from "@se-grants/shared";
import { dateOnlyOut, moneyOut } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(orgId: string) {
    const org = await this.prisma.db.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) {
      return null;
    }
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86_400_000);
    const in21 = new Date(now.getTime() + 21 * 86_400_000);
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const in45 = new Date(now.getTime() + 45 * 86_400_000);
    const applications = await this.prisma.db.application.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        status: { notIn: ["AWARDED", "DECLINED", "WITHDRAWN"] },
        OR: [{ internalDueAt: { lte: in21 } }, { funderDeadlineAt: { lte: in21 } }],
      },
      include: { checklist: true },
    });
    const compliance = await this.prisma.db.complianceItem.findMany({
      where: { organizationId: orgId, isActive: true, dueAt: { lte: in30 } },
    });
    const documents = await this.prisma.db.document.findMany({
      where: { organizationId: orgId, deletedAt: null, expiresAt: { lte: in45 } },
    });
    const watches = await this.prisma.db.opportunityWatch.findMany({
      where: {
        organizationId: orgId,
        opportunity: { deadlineAt: { lte: in30, gte: now }, status: { in: ["OPEN", "UPCOMING"] } },
      },
      include: { opportunity: true },
    });
    const actions: NextAction[] = [];
    for (const application of applications) {
      const due = application.internalDueAt ?? application.funderDeadlineAt;
      for (const item of application.checklist) {
        if (item.doneAt) continue;
        actions.push({
          type: "application",
          title: item.label,
          dueAt: (item.dueAt ?? due ?? now).toISOString(),
          href: `/app/o/${org.slug}/applications/${application.id}`,
        });
      }
    }
    for (const item of compliance) {
      actions.push({
        type: "compliance",
        title: item.title,
        dueAt: item.dueAt.toISOString(),
        href: `/app/o/${org.slug}/compliance`,
      });
    }
    for (const document of documents) {
      if (!document.expiresAt) continue;
      actions.push({
        type: "document",
        title: document.title,
        dueAt: document.expiresAt.toISOString(),
        href: `/app/o/${org.slug}/documents`,
      });
    }
    for (const watch of watches) {
      if (!watch.opportunity.deadlineAt) continue;
      actions.push({
        type: "opportunity",
        title: watch.opportunity.title,
        dueAt: watch.opportunity.deadlineAt.toISOString(),
        href: `/app/o/${org.slug}/opportunities/${watch.opportunity.slug}`,
      });
    }
    const grouped = await this.prisma.db.application.groupBy({
      by: ["status"],
      where: { organizationId: orgId, deletedAt: null },
      _count: { _all: true },
    });
    const allDocs = await this.prisma.db.document.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { kind: true, id: true, title: true, expiresAt: true },
    });
    const upcoming = actions.filter((action) => action.dueAt <= in14.toISOString());
    return {
      nextActions: rankNextActions(actions, 5),
      upcomingDeadlines: rankNextActions(upcoming, 20),
      applicationsByStatus: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
      completeness: profileCompleteness({
        type: org.type,
        community: org.community,
        focusAreas: org.focusAreas,
        mission: org.mission,
        website: org.website,
        ein: org.ein,
        uei: org.uei,
        annualBudget: moneyOut(org.annualBudget),
        receivesFederalFunds: org.receivesFederalFunds,
        fiscalSponsorName: org.fiscalSponsorName,
      }),
      packetMissing: packetMissing(allDocs.map((row) => row.kind)),
      expiringDocuments: allDocs
        .filter((row) => row.expiresAt && row.expiresAt <= in45)
        .map((row) => ({ id: row.id, title: row.title, expiresAt: dateOnlyOut(row.expiresAt) })),
    };
  }

  /** Same collection as the dashboard, capped at 3, across several organizations. */
  async nextForOrgs(orgIds: string[], limit: number) {
    const collected: NextAction[] = [];
    for (const orgId of orgIds) {
      const dashboard = await this.get(orgId);
      if (dashboard) collected.push(...dashboard.nextActions);
    }
    return rankNextActions(collected, limit);
  }
}

export function within(value: Date | null, end: Date): boolean {
  return value != null && value.getTime() <= end.getTime();
}
