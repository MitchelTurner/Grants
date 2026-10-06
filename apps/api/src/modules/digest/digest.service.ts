import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomToken, sha256 } from "../../common/crypto";
import { iso } from "../../common/http/values";
import { MailService } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import { QueueService } from "../../common/jobs/queue.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { localParts } from "@se-grants/shared";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";
import { RedisService } from "../../common/redis/redis.service";

@Injectable()
export class DigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly queue: QueueService,
    private readonly dashboard: DashboardService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async subscribe(input: { email: string; communities?: string[]; focusAreas?: string[] }) {
    const confirm = randomToken();
    const unsub = randomToken();
    await this.prisma.db.digestSubscriber.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        communities: input.communities ?? [],
        focusAreas: input.focusAreas ?? [],
        confirmTokenHash: sha256(confirm),
        unsubTokenHash: sha256(unsub),
      },
      update: {
        communities: input.communities ?? [],
        focusAreas: input.focusAreas ?? [],
        confirmTokenHash: sha256(confirm),
        unsubscribedAt: null,
        confirmedAt: null,
      },
    });
    const link = `${this.env.APP_URL}/api/v1/public/digest/confirm?token=${encodeURIComponent(confirm)}`;
    await this.mail.send({
      to: input.email,
      subject: "Confirm the Southeast Grants digest",
      text: `Confirm your subscription:\n${link}\n`,
    });
    return { ok: true };
  }

  async confirm(token: string): Promise<boolean> {
    const row = await this.prisma.db.digestSubscriber.findUnique({
      where: { confirmTokenHash: sha256(token) },
    });
    if (!row) return false;
    await this.prisma.db.digestSubscriber.update({
      where: { id: row.id },
      data: { confirmedAt: new Date(), confirmTokenHash: null },
    });
    return true;
  }

  async unsubscribe(token: string): Promise<boolean> {
    const row = await this.prisma.db.digestSubscriber.findUnique({
      where: { unsubTokenHash: sha256(token) },
    });
    if (!row) return false;
    await this.prisma.db.digestSubscriber.update({
      where: { id: row.id },
      data: { unsubscribedAt: new Date() },
    });
    return true;
  }

  async draftPublicIssue(): Promise<string> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const until = new Date(Date.now() + 30 * 86_400_000);
    const rows = await this.prisma.db.opportunity.findMany({
      where: {
        isPublic: true,
        status: { in: ["OPEN", "UPCOMING"] },
        funder: { isPublished: true },
        OR: [{ updatedAt: { gte: since } }, { deadlineAt: { lte: until, gte: new Date() } }],
      },
      include: { funder: true },
      take: 30,
    });
    const lines = rows.map((row) => `- ${row.title} (${row.funder.name})`);
    const issue = await this.prisma.db.digestIssue.create({
      data: {
        subject: "Southeast Grants digest",
        bodyMd: lines.length > 0 ? lines.join("\n") : "No new opportunities this week.",
        opportunityIds: rows.map((row) => row.id),
        status: "DRAFT",
      },
    });
    return issue.id;
  }

  async listIssues() {
    const rows = await this.prisma.db.digestIssue.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      bodyMd: row.bodyMd,
      opportunityIds: row.opportunityIds,
      status: row.status,
      sentAt: iso(row.sentAt),
    }));
  }

  async updateIssue(
    id: string,
    input: { subject?: string; bodyMd?: string; opportunityIds?: string[] },
  ) {
    const issue = await this.prisma.db.digestIssue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException("That digest was not found.");
    if (issue.status === "SENT") throw new BadRequestException("A sent digest cannot be edited.");
    const updated = await this.prisma.db.digestIssue.update({ where: { id }, data: input });
    return { id: updated.id, status: updated.status };
  }

  async approve(id: string, userId: string) {
    const issue = await this.prisma.db.digestIssue.findUnique({ where: { id } });
    if (!issue || issue.status === "SENT")
      throw new NotFoundException("That digest was not found.");
    await this.prisma.db.digestIssue.update({
      where: { id },
      data: { status: "APPROVED", approvedById: userId },
    });
    return { id, status: "APPROVED" as const };
  }

  async enqueueSend(id: string) {
    const issue = await this.prisma.db.digestIssue.findUnique({ where: { id } });
    if (!issue || issue.status !== "APPROVED") {
      throw new BadRequestException("Approve the digest before sending it.");
    }
    await this.queue.enqueue("digest:public-send", { issueId: id }, { jobId: `digest-send-${id}` });
    return { queued: true };
  }

  async sendPublic(issueId: string): Promise<number> {
    const issue = await this.prisma.db.digestIssue.findUnique({ where: { id: issueId } });
    if (!issue || issue.status !== "APPROVED") return 0;
    const subscribers = await this.prisma.db.digestSubscriber.findMany({
      where: { confirmedAt: { not: null }, unsubscribedAt: null },
    });
    const opportunities = await this.prisma.db.opportunity.findMany({
      where: { id: { in: issue.opportunityIds } },
    });
    let sent = 0;
    for (const subscriber of subscribers) {
      const matches = opportunities.filter((row) => matchesPrefs(subscriber, row));
      if (subscriber.focusAreas.length > 0 && matches.length === 0 && opportunities.length > 0) {
        continue;
      }
      const unsub = randomToken();
      await this.prisma.db.digestSubscriber.update({
        where: { id: subscriber.id },
        data: { unsubTokenHash: sha256(unsub) },
      });
      const unsubUrl = `${this.env.APP_URL}/api/v1/public/digest/unsubscribe?token=${encodeURIComponent(unsub)}`;
      await this.mail.send({
        to: subscriber.email,
        subject: issue.subject,
        stream: "broadcast",
        text: `${issue.bodyMd}\n\nUnsubscribe: ${unsubUrl}\n`,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent += 1;
    }
    await this.prisma.db.digestIssue.update({
      where: { id: issue.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return sent;
  }

  async sendUserWeeklies(now = new Date()): Promise<number> {
    const users = await this.prisma.db.user.findMany({
      where: { notificationPref: { weeklyDigest: true, emailEnabled: true } },
      include: {
        notificationPref: true,
        memberships: { where: { organization: { deletedAt: null } } },
      },
    });
    let sent = 0;
    for (const user of users) {
      const pref = user.notificationPref;
      if (!pref) continue;
      const local = localParts(now, user.timezone);
      if (local.weekday !== pref.digestWeekday || local.hour !== pref.digestHour) continue;
      const weekKey = `user-digest:${user.id}:${local.year}-W${weekNumber(local)}`;
      if (await this.redis.read(weekKey)) continue;
      const actions = await this.dashboard.nextForOrgs(
        user.memberships.map((row) => row.organizationId),
        3,
      );
      if (actions.length === 0) continue;
      const lines = actions.map((action) => `- ${action.title}`);
      await this.mail.send({
        to: user.email,
        subject: "Your next actions",
        text: `Your next 3 actions:\n${lines.join("\n")}\n\nManage notifications: ${this.env.APP_URL}/app/me\n`,
      });
      await this.redis.put(weekKey, "1", 14 * 24 * 60 * 60);
      sent += 1;
    }
    return sent;
  }
}

function matchesPrefs(
  subscriber: { communities: string[]; focusAreas: string[] },
  opportunity: { focusAreas: string[]; eligibleCommunities: string[] },
): boolean {
  const focusOk =
    subscriber.focusAreas.length === 0 ||
    subscriber.focusAreas.some((area) => opportunity.focusAreas.includes(area));
  const communityOk =
    subscriber.communities.length === 0 ||
    opportunity.eligibleCommunities.length === 0 ||
    subscriber.communities.some((community) => opportunity.eligibleCommunities.includes(community));
  return focusOk && communityOk;
}

function weekNumber(local: { year: number; month: number; day: number }): number {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const start = new Date(Date.UTC(local.year, 0, 1));
  return Math.ceil(((date.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7);
}
