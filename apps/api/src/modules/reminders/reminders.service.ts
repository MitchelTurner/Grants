import { Injectable } from "@nestjs/common";
import {
  DOCUMENT_EXPIRY_OFFSETS,
  SMS_MAX_OFFSET_DAYS,
  addDays,
  smsBody,
  zonedDateTime,
} from "@se-grants/shared";
import type { ReminderTarget } from "@se-grants/db";
import { QueueService } from "../../common/jobs/queue.service";
import { MailService } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SmsService } from "../../common/sms/sms.provider";
import { shiftSmsToQuietEnd } from "@se-grants/shared";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";

type Recipient = {
  id: string;
  email: string;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  smsOptIn: boolean;
  timezone: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  offsets: number[];
  quietStartHour: number;
  quietEndHour: number;
};

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly queue: QueueService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async syncDocument(documentId: string): Promise<void> {
    const document = await this.prisma.db.document.findFirst({
      where: { id: documentId, deletedAt: null },
      include: { organization: true },
    });
    if (!document?.expiresAt) {
      await this.clear("DOCUMENT_EXPIRY", documentId);
      return;
    }
    const due = zonedDateTime(
      document.expiresAt.toISOString().slice(0, 10),
      17,
      document.organization.timezone,
    );
    await this.replace({
      organizationId: document.organizationId,
      targetType: "DOCUMENT_EXPIRY",
      targetId: document.id,
      due,
      offsets: [...DOCUMENT_EXPIRY_OFFSETS],
      recipients: await this.leaders(document.organizationId),
      title: document.title,
      linkPath: `/app/o/${document.organization.slug}/documents`,
      itemsLeft: null,
    });
  }

  async syncCompliance(complianceId: string): Promise<void> {
    const item = await this.prisma.db.complianceItem.findUnique({
      where: { id: complianceId },
      include: { organization: true },
    });
    if (!item || !item.isActive) {
      await this.clear("COMPLIANCE_ITEM", complianceId);
      return;
    }
    const due = zonedDateTime(
      item.dueAt.toISOString().slice(0, 10),
      17,
      item.organization.timezone,
    );
    await this.replace({
      organizationId: item.organizationId,
      targetType: "COMPLIANCE_ITEM",
      targetId: item.id,
      due,
      offsets: null,
      recipients: await this.leaders(item.organizationId),
      title: item.title,
      linkPath: `/app/o/${item.organization.slug}/compliance`,
      itemsLeft: null,
    });
  }

  async syncChecklist(itemId: string): Promise<void> {
    const item = await this.prisma.db.checklistItem.findUnique({
      where: { id: itemId },
      include: { application: { include: { organization: true } } },
    });
    if (!item || item.doneAt || !item.dueAt || !item.assigneeId || item.application.deletedAt) {
      await this.clear("CHECKLIST_ITEM", itemId);
      return;
    }
    const recipients = await this.people(item.application.organizationId, [item.assigneeId]);
    await this.replace({
      organizationId: item.application.organizationId,
      targetType: "CHECKLIST_ITEM",
      targetId: item.id,
      due: item.dueAt,
      offsets: null,
      recipients,
      title: item.label,
      linkPath: `/app/o/${item.application.organization.slug}/applications/${item.applicationId}`,
      itemsLeft: null,
    });
  }

  async syncApplication(applicationId: string): Promise<void> {
    const application = await this.prisma.db.application.findFirst({
      where: { id: applicationId },
      include: { organization: true, checklist: true },
    });
    if (
      !application ||
      application.deletedAt ||
      ["AWARDED", "DECLINED", "WITHDRAWN"].includes(application.status)
    ) {
      await this.clear("APPLICATION_DUE", applicationId);
      await this.clear("APPLICATION_DUE", `${applicationId}:internal`);
      return;
    }
    const open = application.checklist.filter((item) => !item.doneAt).length;
    const recipientIds = application.ownerUserId
      ? [application.ownerUserId]
      : (await this.leaders(application.organizationId)).map((person) => person.id);
    const recipients = await this.people(application.organizationId, recipientIds);
    await this.replace({
      organizationId: application.organizationId,
      targetType: "APPLICATION_DUE",
      targetId: application.id,
      due: application.funderDeadlineAt,
      offsets: null,
      recipients,
      title: application.title,
      linkPath: `/app/o/${application.organization.slug}/applications/${application.id}`,
      itemsLeft: open,
    });
    await this.replace({
      organizationId: application.organizationId,
      targetType: "APPLICATION_DUE",
      targetId: `${application.id}:internal`,
      due: application.internalDueAt,
      offsets: null,
      recipients,
      title: `${application.title} (internal)`,
      linkPath: `/app/o/${application.organization.slug}/applications/${application.id}`,
      itemsLeft: open,
    });
  }

  async syncReport(reportId: string): Promise<void> {
    const report = await this.prisma.db.reportRequirement.findUnique({
      where: { id: reportId },
      include: { award: { include: { organization: true, application: true } } },
    });
    if (!report || report.status === "SUBMITTED") {
      await this.clear("REPORT_DUE", reportId);
      return;
    }
    await this.replace({
      organizationId: report.award.organizationId,
      targetType: "REPORT_DUE",
      targetId: report.id,
      due: report.dueAt,
      offsets: null,
      recipients: await this.leaders(report.award.organizationId),
      title: `${report.award.application.title} report`,
      linkPath: `/app/o/${report.award.organization.slug}/awards/${report.awardId}`,
      itemsLeft: null,
    });
  }

  async syncFollowUp(interactionId: string): Promise<void> {
    const row = await this.prisma.db.funderInteraction.findUnique({
      where: { id: interactionId },
      include: { organization: true },
    });
    if (!row?.followUpAt) {
      await this.clear("FUNDER_FOLLOW_UP", interactionId);
      return;
    }
    await this.replace({
      organizationId: row.organizationId,
      targetType: "FUNDER_FOLLOW_UP",
      targetId: row.id,
      due: row.followUpAt,
      offsets: null,
      recipients: await this.editors(row.organizationId),
      title: `Follow up with ${row.contactName}`,
      linkPath: `/app/o/${row.organization.slug}/relationships`,
      itemsLeft: null,
    });
  }

  async syncWatch(organizationId: string, opportunityId: string): Promise<void> {
    const watch = await this.prisma.db.opportunityWatch.findUnique({
      where: { organizationId_opportunityId: { organizationId, opportunityId } },
      include: { opportunity: true, organization: true },
    });
    const targetId = `${organizationId}:${opportunityId}`;
    if (!watch || !watch.opportunity.deadlineAt || watch.opportunity.status === "ARCHIVED") {
      await this.clear("OPPORTUNITY_DEADLINE", targetId);
      return;
    }
    const recipients = await this.editors(organizationId);
    await this.replace({
      organizationId,
      targetType: "OPPORTUNITY_DEADLINE",
      targetId,
      due: watch.opportunity.deadlineAt,
      offsets: null,
      recipients,
      title: watch.opportunity.title,
      linkPath: `/app/o/${watch.organization.slug}/opportunities/${watch.opportunity.slug}`,
      itemsLeft: null,
    });
  }

  async clear(targetType: ReminderTarget, targetId: string): Promise<void> {
    await this.prisma.db.reminder.updateMany({
      where: { targetType, targetId, status: "PENDING" },
      data: { status: "CANCELED" },
    });
  }

  async send(reminderId: string): Promise<void> {
    const reminder = await this.prisma.db.reminder.findUnique({
      where: { id: reminderId },
      include: { recipient: true, organization: true },
    });
    if (!reminder || reminder.status !== "PENDING") return;
    const current = await this.currentDue(reminder.targetType, reminder.targetId);
    if (!current || current.getTime() !== reminder.dueAtSnapshot.getTime()) {
      await this.prisma.db.reminder.update({
        where: { id: reminder.id },
        data: { status: "SKIPPED" },
      });
      return;
    }
    const days = Math.max(0, Math.round((current.getTime() - Date.now()) / 86_400_000));
    const link = `${this.env.APP_URL}${await this.linkFor(reminder.targetType, reminder.targetId, reminder.organization.slug)}`;
    const title = await this.titleFor(reminder.targetType, reminder.targetId);
    try {
      if (reminder.channel === "EMAIL") {
        await this.mail.send({
          to: reminder.recipient.email,
          subject: `Due in ${days} days: ${title}`,
          text: `${title} is due in ${days} days.\n\nOpen it: ${link}\n\nManage notifications: ${this.env.APP_URL}/app/me\n`,
        });
      } else {
        await this.sms.send({
          to: reminder.recipient.phone ?? "",
          body: smsBody({ title, days, itemsLeft: null, link }),
        });
      }
      await this.prisma.db.reminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
    } catch (error) {
      const permanent = error instanceof Error && error.name.startsWith("Permanent");
      if (permanent) {
        await this.prisma.db.reminder.update({
          where: { id: reminder.id },
          data: { status: "FAILED", error: "The message was rejected." },
        });
        return;
      }
      throw error;
    }
  }

  async sweep(): Promise<number> {
    const soon = addDays(new Date(), 0);
    soon.setMinutes(soon.getMinutes() + 30);
    const due = await this.prisma.db.reminder.findMany({
      where: { status: "PENDING", sendAt: { lte: soon } },
      take: 200,
    });
    for (const reminder of due) {
      await this.queue.enqueue(
        "reminders:send",
        { reminderId: reminder.id },
        { jobId: reminder.id, delay: Math.max(0, reminder.sendAt.getTime() - Date.now()) },
      );
    }
    return due.length;
  }

  private async replace(input: {
    organizationId: string;
    targetType: ReminderTarget;
    targetId: string;
    due: Date | null;
    offsets: number[] | null;
    recipients: Recipient[];
    title: string;
    linkPath: string;
    itemsLeft: number | null;
  }): Promise<void> {
    if (!input.due) {
      await this.clear(input.targetType, input.targetId);
      return;
    }
    const wanted = new Set<string>();
    for (const recipient of input.recipients) {
      const offsets = input.offsets ?? recipient.offsets;
      for (const offsetDays of offsets) {
        const channels: Array<"EMAIL" | "SMS"> = [];
        if (recipient.emailEnabled) channels.push("EMAIL");
        if (
          recipient.smsEnabled &&
          recipient.smsOptIn &&
          recipient.phone &&
          recipient.phoneVerifiedAt &&
          offsetDays <= SMS_MAX_OFFSET_DAYS
        ) {
          channels.push("SMS");
        }
        for (const channel of channels) {
          const key = `${recipient.id}:${channel}:${offsetDays}`;
          wanted.add(key);
          const rawSend = addDays(input.due, -offsetDays);
          const sendAt =
            channel === "SMS"
              ? shiftSmsToQuietEnd(
                  rawSend,
                  recipient.timezone,
                  recipient.quietStartHour,
                  recipient.quietEndHour,
                )
              : rawSend;
          const existing = await this.prisma.db.reminder.findUnique({
            where: {
              targetType_targetId_recipientId_channel_offsetDays: {
                targetType: input.targetType,
                targetId: input.targetId,
                recipientId: recipient.id,
                channel,
                offsetDays,
              },
            },
          });
          if (
            existing?.status === "SENT" &&
            existing.dueAtSnapshot.getTime() === input.due.getTime()
          ) {
            continue;
          }
          const row = existing
            ? await this.prisma.db.reminder.update({
                where: { id: existing.id },
                data: {
                  dueAtSnapshot: input.due,
                  sendAt,
                  status: "PENDING",
                  sentAt: null,
                  error: null,
                },
              })
            : await this.prisma.db.reminder.create({
                data: {
                  organizationId: input.organizationId,
                  targetType: input.targetType,
                  targetId: input.targetId,
                  recipientId: recipient.id,
                  channel,
                  offsetDays,
                  dueAtSnapshot: input.due,
                  sendAt,
                },
              });
          await this.queue.enqueue(
            "reminders:send",
            { reminderId: row.id },
            { jobId: row.id, delay: Math.max(0, sendAt.getTime() - Date.now()) },
          );
        }
      }
    }
    const pending = await this.prisma.db.reminder.findMany({
      where: { targetType: input.targetType, targetId: input.targetId, status: "PENDING" },
    });
    for (const row of pending) {
      const key = `${row.recipientId}:${row.channel}:${row.offsetDays}`;
      if (!wanted.has(key)) {
        await this.prisma.db.reminder.update({
          where: { id: row.id },
          data: { status: "CANCELED" },
        });
      }
    }
    void input.title;
    void input.linkPath;
    void input.itemsLeft;
  }

  private async leaders(organizationId: string): Promise<Recipient[]> {
    const rows = await this.prisma.db.membership.findMany({
      where: { organizationId, remindersMuted: false, role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    });
    return this.people(
      organizationId,
      rows.map((row) => row.userId),
    );
  }

  private async editors(organizationId: string): Promise<Recipient[]> {
    const rows = await this.prisma.db.membership.findMany({
      where: {
        organizationId,
        remindersMuted: false,
        role: { in: ["OWNER", "ADMIN", "EDITOR"] },
      },
      select: { userId: true },
    });
    return this.people(
      organizationId,
      rows.map((row) => row.userId),
    );
  }

  private async people(organizationId: string, userIds: string[]): Promise<Recipient[]> {
    if (userIds.length === 0) return [];
    const muted = await this.prisma.db.membership.findMany({
      where: { organizationId, userId: { in: userIds }, remindersMuted: true },
      select: { userId: true },
    });
    const mutedIds = new Set(muted.map((row) => row.userId));
    const users = await this.prisma.db.user.findMany({
      where: { id: { in: userIds.filter((id) => !mutedIds.has(id)) } },
      include: { notificationPref: true },
    });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt,
      smsOptIn: user.smsOptIn,
      timezone: user.timezone,
      emailEnabled: user.notificationPref?.emailEnabled ?? true,
      smsEnabled: user.notificationPref?.smsEnabled ?? false,
      offsets: user.notificationPref?.reminderOffsets ?? [30, 14, 7, 2, 1],
      quietStartHour: user.notificationPref?.quietStartHour ?? 21,
      quietEndHour: user.notificationPref?.quietEndHour ?? 8,
    }));
  }

  private async currentDue(targetType: ReminderTarget, targetId: string): Promise<Date | null> {
    if (targetType === "DOCUMENT_EXPIRY") {
      const document = await this.prisma.db.document.findFirst({
        where: { id: targetId, deletedAt: null },
        include: { organization: true },
      });
      if (!document?.expiresAt) return null;
      return zonedDateTime(
        document.expiresAt.toISOString().slice(0, 10),
        17,
        document.organization.timezone,
      );
    }
    if (targetType === "COMPLIANCE_ITEM") {
      const item = await this.prisma.db.complianceItem.findUnique({
        where: { id: targetId },
        include: { organization: true },
      });
      if (!item?.isActive) return null;
      return zonedDateTime(item.dueAt.toISOString().slice(0, 10), 17, item.organization.timezone);
    }
    if (targetType === "CHECKLIST_ITEM") {
      const item = await this.prisma.db.checklistItem.findUnique({ where: { id: targetId } });
      if (!item || item.doneAt) return null;
      return item.dueAt;
    }
    if (targetType === "APPLICATION_DUE") {
      const internal = targetId.endsWith(":internal");
      const id = internal ? targetId.slice(0, -":internal".length) : targetId;
      const application = await this.prisma.db.application.findFirst({
        where: { id, deletedAt: null },
      });
      if (!application || ["AWARDED", "DECLINED", "WITHDRAWN"].includes(application.status))
        return null;
      return internal ? application.internalDueAt : application.funderDeadlineAt;
    }
    const [organizationId, opportunityId] = targetId.split(":");
    if (!organizationId || !opportunityId) return null;
    const watch = await this.prisma.db.opportunityWatch.findUnique({
      where: { organizationId_opportunityId: { organizationId, opportunityId } },
      include: { opportunity: true },
    });
    return watch?.opportunity.deadlineAt ?? null;
  }

  private async titleFor(targetType: ReminderTarget, targetId: string): Promise<string> {
    if (targetType === "DOCUMENT_EXPIRY") {
      const row = await this.prisma.db.document.findUnique({ where: { id: targetId } });
      return row?.title ?? "Document";
    }
    if (targetType === "COMPLIANCE_ITEM") {
      const row = await this.prisma.db.complianceItem.findUnique({ where: { id: targetId } });
      return row?.title ?? "Compliance item";
    }
    if (targetType === "CHECKLIST_ITEM") {
      const row = await this.prisma.db.checklistItem.findUnique({ where: { id: targetId } });
      return row?.label ?? "Checklist item";
    }
    if (targetType === "APPLICATION_DUE") {
      const id = targetId.endsWith(":internal") ? targetId.slice(0, -":internal".length) : targetId;
      const row = await this.prisma.db.application.findUnique({ where: { id } });
      const title = row?.title ?? "Application";
      return targetId.endsWith(":internal") ? `${title} (internal)` : title;
    }
    if (targetType === "REPORT_DUE") return "Funder report";
    if (targetType === "FUNDER_FOLLOW_UP") return "Funder follow-up";
    const opportunityId = targetId.split(":")[1];
    const row = opportunityId
      ? await this.prisma.db.opportunity.findUnique({ where: { id: opportunityId } })
      : null;
    return row?.title ?? "Opportunity";
  }

  private async linkFor(
    targetType: ReminderTarget,
    targetId: string,
    slug: string,
  ): Promise<string> {
    if (targetType === "DOCUMENT_EXPIRY") return `/app/o/${slug}/documents`;
    if (targetType === "COMPLIANCE_ITEM") return `/app/o/${slug}/compliance`;
    if (targetType === "CHECKLIST_ITEM") {
      const item = await this.prisma.db.checklistItem.findUnique({ where: { id: targetId } });
      return `/app/o/${slug}/applications/${item?.applicationId ?? ""}`;
    }
    if (targetType === "APPLICATION_DUE") {
      const id = targetId.endsWith(":internal") ? targetId.slice(0, -":internal".length) : targetId;
      return `/app/o/${slug}/applications/${id}`;
    }
    if (targetType === "REPORT_DUE") return `/app/o/${slug}/awards`;
    if (targetType === "FUNDER_FOLLOW_UP") return `/app/o/${slug}/relationships`;
    const opportunityId = targetId.split(":")[1];
    const row = opportunityId
      ? await this.prisma.db.opportunity.findUnique({ where: { id: opportunityId } })
      : null;
    return `/app/o/${slug}/opportunities/${row?.slug ?? ""}`;
  }
}
