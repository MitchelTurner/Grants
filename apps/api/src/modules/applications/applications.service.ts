import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  checklistForFunder,
  packetMissing,
  subtractBusinessDays,
  type ApplicationStatus,
  type ChecklistKind,
  type FunderType,
} from "@se-grants/shared";
import { cursorFilter, encodeCursor } from "../../common/http/pagination";
import { iso, moneyOut } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RemindersService } from "../reminders/reminders.service";

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
  ) {}

  async list(orgId: string, cursor?: string, limit = 25) {
    const rows = await this.prisma.db.application.findMany({
      where: { organizationId: orgId, deletedAt: null, ...(cursorFilter(cursor) ?? {}) },
      include: {
        checklist: { orderBy: { sortOrder: "asc" } },
        opportunity: { include: { funder: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.toDto(row)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async create(
    orgId: string,
    input: {
      title: string;
      customFunderName?: string;
      amountRequested?: string;
      funderDeadlineAt?: string;
      internalDueAt?: string;
      notes?: string;
    },
  ) {
    const application = await this.prisma.db.application.create({
      data: {
        organizationId: orgId,
        title: input.title,
        customFunderName: input.customFunderName,
        amountRequested: input.amountRequested,
        funderDeadlineAt: input.funderDeadlineAt ? new Date(input.funderDeadlineAt) : null,
        internalDueAt: input.internalDueAt
          ? new Date(input.internalDueAt)
          : input.funderDeadlineAt
            ? await this.internalDue(orgId, new Date(input.funderDeadlineAt))
            : null,
        notes: input.notes,
        checklist: {
          create: checklistForFunder(null).map((item, index) => ({
            label: item.label,
            kind: item.kind,
            source: "TEMPLATE",
            sortOrder: index,
          })),
        },
      },
      include: { checklist: true, opportunity: { include: { funder: true } } },
    });
    await this.reminders.syncApplication(application.id);
    return this.toDto(application);
  }

  async fromOpportunity(orgId: string, opportunityId: string) {
    const opportunity = await this.prisma.db.opportunity.findFirst({
      where: { id: opportunityId, status: { notIn: ["DRAFT", "ARCHIVED"] }, isPublic: true },
      include: { funder: true },
    });
    if (!opportunity) throw new NotFoundException("That opportunity was not found.");
    const internal = opportunity.deadlineAt
      ? await this.internalDue(orgId, opportunity.deadlineAt)
      : null;
    const items = checklistForFunder(opportunity.funder.type);
    const application = await this.prisma.db.application.create({
      data: {
        organizationId: orgId,
        opportunityId: opportunity.id,
        title: opportunity.title,
        amountRequested: opportunity.maxAmount,
        funderDeadlineAt: opportunity.deadlineAt,
        internalDueAt: internal,
        checklist: {
          create: items.map((item, index) => ({
            label: item.label,
            kind: item.kind,
            source: "TEMPLATE",
            sortOrder: index,
          })),
        },
      },
      include: { checklist: true, opportunity: { include: { funder: true } } },
    });
    await this.reminders.syncApplication(application.id);
    return this.toDto(application);
  }

  async get(orgId: string, id: string) {
    const application = await this.require(orgId, id);
    const kinds = await this.prisma.db.document.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { kind: true },
    });
    const open = application.checklist.filter((item) => !item.doneAt);
    const due = application.funderDeadlineAt ?? application.internalDueAt;
    const daysRemaining = due ? Math.ceil((due.getTime() - Date.now()) / 86_400_000) : null;
    return {
      ...this.toDto(application),
      daysRemaining,
      openChecklist: open.length,
      packetMissing: packetMissing(kinds.map((row) => row.kind)),
    };
  }

  async update(
    orgId: string,
    id: string,
    input: {
      title?: string;
      status?: ApplicationStatus;
      customFunderName?: string | null;
      amountRequested?: string | null;
      amountAwarded?: string | null;
      funderDeadlineAt?: string | null;
      internalDueAt?: string | null;
      submittedAt?: string | null;
      decisionAt?: string | null;
      ownerUserId?: string | null;
      notes?: string | null;
      declineFeedback?: string | null;
    },
  ) {
    const current = await this.require(orgId, id);
    if (input.status === "DECLINED" && !(input.declineFeedback ?? current.declineFeedback)) {
      throw new BadRequestException("Add the funder's feedback before marking this declined.");
    }
    if (input.status === "AWARDED" && !(input.amountAwarded ?? current.amountAwarded)) {
      throw new BadRequestException("Enter the awarded amount.");
    }
    if (input.ownerUserId) {
      const member = await this.prisma.db.membership.findUnique({
        where: { userId_organizationId: { userId: input.ownerUserId, organizationId: orgId } },
      });
      if (!member) throw new BadRequestException("That person is not in this organization.");
    }
    const application = await this.prisma.db.application.update({
      where: { id },
      data: {
        title: input.title,
        status: input.status,
        customFunderName: input.customFunderName,
        amountRequested: input.amountRequested,
        amountAwarded: input.amountAwarded,
        funderDeadlineAt:
          input.funderDeadlineAt === undefined
            ? undefined
            : input.funderDeadlineAt
              ? new Date(input.funderDeadlineAt)
              : null,
        internalDueAt:
          input.internalDueAt === undefined
            ? undefined
            : input.internalDueAt
              ? new Date(input.internalDueAt)
              : null,
        submittedAt:
          input.submittedAt === undefined
            ? undefined
            : input.submittedAt
              ? new Date(input.submittedAt)
              : input.status === "SUBMITTED"
                ? new Date()
                : null,
        decisionAt:
          input.decisionAt === undefined
            ? undefined
            : input.decisionAt
              ? new Date(input.decisionAt)
              : input.status === "AWARDED" || input.status === "DECLINED"
                ? new Date()
                : null,
        ownerUserId: input.ownerUserId,
        notes: input.notes,
        declineFeedback: input.declineFeedback,
      },
      include: {
        checklist: { orderBy: { sortOrder: "asc" } },
        opportunity: { include: { funder: true } },
      },
    });
    await this.reminders.syncApplication(application.id);
    return this.toDto(application);
  }

  async remove(orgId: string, id: string) {
    await this.require(orgId, id);
    await this.prisma.db.application.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.reminders.syncApplication(id);
  }

  async addChecklist(
    orgId: string,
    applicationId: string,
    input: {
      label: string;
      kind?: ChecklistKind;
      dueAt?: string | null;
      assigneeId?: string | null;
      notes?: string | null;
    },
  ) {
    await this.require(orgId, applicationId);
    const count = await this.prisma.db.checklistItem.count({ where: { applicationId } });
    const item = await this.prisma.db.checklistItem.create({
      data: {
        applicationId,
        label: input.label,
        kind: input.kind ?? "OTHER",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        assigneeId: input.assigneeId,
        notes: input.notes,
        sortOrder: count,
      },
    });
    await this.reminders.syncChecklist(item.id);
    return this.itemDto(item);
  }

  async updateChecklist(
    orgId: string,
    applicationId: string,
    itemId: string,
    input: {
      label?: string;
      kind?: ChecklistKind;
      dueAt?: string | null;
      assigneeId?: string | null;
      notes?: string | null;
      linkedDocumentId?: string | null;
      done?: boolean;
    },
  ) {
    const item = await this.requireItem(orgId, applicationId, itemId);
    if (input.linkedDocumentId) {
      const document = await this.prisma.db.document.findFirst({
        where: { id: input.linkedDocumentId, organizationId: orgId, deletedAt: null },
      });
      if (!document) throw new NotFoundException("That document was not found.");
    }
    const kind = input.kind ?? item.kind;
    const autoDone = Boolean(input.linkedDocumentId) && kind === "ATTACHMENT";
    const updated = await this.prisma.db.checklistItem.update({
      where: { id: item.id },
      data: {
        label: input.label,
        kind: input.kind,
        dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
        assigneeId: input.assigneeId,
        notes: input.notes,
        linkedDocumentId: input.linkedDocumentId,
        doneAt:
          input.done === undefined
            ? autoDone
              ? new Date()
              : undefined
            : input.done
              ? new Date()
              : null,
      },
    });
    await this.reminders.syncChecklist(updated.id);
    await this.reminders.syncApplication(applicationId);
    return this.itemDto(updated);
  }

  async removeChecklist(orgId: string, applicationId: string, itemId: string) {
    const item = await this.requireItem(orgId, applicationId, itemId);
    await this.prisma.db.checklistItem.delete({ where: { id: item.id } });
    await this.reminders.clear("CHECKLIST_ITEM", item.id);
  }

  async reorder(orgId: string, applicationId: string, ids: string[]) {
    await this.require(orgId, applicationId);
    const existing = await this.prisma.db.checklistItem.findMany({ where: { applicationId } });
    if (existing.length !== ids.length || existing.some((item) => !ids.includes(item.id))) {
      throw new BadRequestException("Include every checklist item, once.");
    }
    await Promise.all(
      ids.map((id, index) =>
        this.prisma.db.checklistItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.get(orgId, applicationId);
  }

  private async internalDue(orgId: string, deadline: Date): Promise<Date> {
    const org = await this.prisma.db.organization.findUnique({ where: { id: orgId } });
    const setting = await this.prisma.db.platformSetting.findUnique({
      where: { key: "DEFAULT_INTERNAL_BUFFER_BUSINESS_DAYS" },
    });
    const days = Number(setting?.value ?? "3");
    return subtractBusinessDays(
      deadline,
      Number.isFinite(days) ? days : 3,
      org?.timezone ?? "America/Juneau",
    );
  }

  private async require(orgId: string, id: string) {
    const application = await this.prisma.db.application.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        checklist: { orderBy: { sortOrder: "asc" } },
        opportunity: { include: { funder: true } },
      },
    });
    if (!application) throw new NotFoundException("That application was not found.");
    return application;
  }

  private async requireItem(orgId: string, applicationId: string, itemId: string) {
    await this.require(orgId, applicationId);
    const item = await this.prisma.db.checklistItem.findFirst({
      where: { id: itemId, applicationId },
    });
    if (!item) throw new NotFoundException("That checklist item was not found.");
    return item;
  }

  private toDto(application: {
    id: string;
    title: string;
    status: ApplicationStatus;
    opportunityId: string | null;
    customFunderName: string | null;
    amountRequested: { toString(): string } | null;
    amountAwarded: { toString(): string } | null;
    funderDeadlineAt: Date | null;
    internalDueAt: Date | null;
    submittedAt: Date | null;
    decisionAt: Date | null;
    ownerUserId: string | null;
    notes: string | null;
    declineFeedback: string | null;
    checklist: Array<{
      id: string;
      label: string;
      kind: ChecklistKind;
      source: string;
      sortOrder: number;
      dueAt: Date | null;
      assigneeId: string | null;
      doneAt: Date | null;
      linkedDocumentId: string | null;
      notes: string | null;
    }>;
    opportunity: { title: string; slug: string; funder: { name: string; type: FunderType } } | null;
  }) {
    return {
      id: application.id,
      title: application.title,
      status: application.status,
      opportunityId: application.opportunityId,
      opportunityTitle: application.opportunity?.title ?? null,
      opportunitySlug: application.opportunity?.slug ?? null,
      funderName: application.opportunity?.funder.name ?? application.customFunderName,
      customFunderName: application.customFunderName,
      amountRequested: moneyOut(application.amountRequested),
      amountAwarded: moneyOut(application.amountAwarded),
      funderDeadlineAt: iso(application.funderDeadlineAt),
      internalDueAt: iso(application.internalDueAt),
      submittedAt: iso(application.submittedAt),
      decisionAt: iso(application.decisionAt),
      ownerUserId: application.ownerUserId,
      notes: application.notes,
      declineFeedback: application.declineFeedback,
      checklist: application.checklist.map((item) => this.itemDto(item)),
    };
  }

  private itemDto(item: {
    id: string;
    label: string;
    kind: ChecklistKind;
    source: string;
    sortOrder: number;
    dueAt: Date | null;
    assigneeId: string | null;
    doneAt: Date | null;
    linkedDocumentId: string | null;
    notes: string | null;
  }) {
    return {
      id: item.id,
      label: item.label,
      kind: item.kind,
      source: item.source,
      sortOrder: item.sortOrder,
      dueAt: iso(item.dueAt),
      assigneeId: item.assigneeId,
      doneAt: iso(item.doneAt),
      linkedDocumentId: item.linkedDocumentId,
      notes: item.notes,
    };
  }
}
