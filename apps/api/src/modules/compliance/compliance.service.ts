import { Injectable, NotFoundException } from "@nestjs/common";
import {
  complianceTemplatesFor,
  nextDueDate,
  type ComplianceKind,
  type OrgType,
} from "@se-grants/shared";
import { dateOnlyIn, dateOnlyOut, iso } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RemindersService } from "../reminders/reminders.service";

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
  ) {}

  templates(input: {
    orgType: OrgType;
    receivesFederalFunds: boolean;
    fiscalYearStartMonth?: number;
  }) {
    return complianceTemplatesFor({
      orgType: input.orgType,
      receivesFederalFunds: input.receivesFederalFunds,
      fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
      today: new Date().toISOString().slice(0, 10),
    });
  }

  async list(orgId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.prisma.db.complianceItem.findMany({
      where: { organizationId: orgId },
      orderBy: { dueAt: "asc" },
    });
    return rows.map((row) => {
      const due = dateOnlyOut(row.dueAt) ?? today;
      const status = !row.isActive
        ? "inactive"
        : due < today
          ? "overdue"
          : due <= soon
            ? "due_soon"
            : "ok";
      return { ...this.toDto(row), status };
    });
  }

  async create(
    orgId: string,
    input: {
      kind: ComplianceKind;
      title: string;
      description?: string;
      dueAt: string;
      rrule?: string | null;
      templateId?: string;
    },
  ) {
    const item = await this.prisma.db.complianceItem.create({
      data: {
        organizationId: orgId,
        kind: input.kind,
        title: input.title,
        description: input.description,
        dueAt: dateOnlyIn(input.dueAt),
        rrule: input.rrule,
      },
    });
    await this.reminders.syncCompliance(item.id);
    return this.toDto(item);
  }

  async update(
    orgId: string,
    id: string,
    input: {
      title?: string;
      description?: string | null;
      dueAt?: string;
      rrule?: string | null;
      isActive?: boolean;
      linkedDocumentId?: string | null;
    },
  ) {
    await this.require(orgId, id);
    const item = await this.prisma.db.complianceItem.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        dueAt: input.dueAt ? dateOnlyIn(input.dueAt) : undefined,
        rrule: input.rrule,
        isActive: input.isActive,
        linkedDocumentId: input.linkedDocumentId,
      },
    });
    await this.reminders.syncCompliance(item.id);
    return this.toDto(item);
  }

  async remove(orgId: string, id: string) {
    await this.require(orgId, id);
    await this.prisma.db.complianceItem.delete({ where: { id } });
    await this.reminders.clear("COMPLIANCE_ITEM", id);
  }

  async complete(orgId: string, id: string) {
    const item = await this.require(orgId, id);
    const current = dateOnlyOut(item.dueAt) ?? new Date().toISOString().slice(0, 10);
    const next = item.rrule ? nextDueDate(item.rrule, current) : null;
    const updated = await this.prisma.db.complianceItem.update({
      where: { id },
      data: {
        lastCompletedAt: new Date(),
        dueAt: next ? dateOnlyIn(next) : item.dueAt,
      },
    });
    await this.reminders.syncCompliance(updated.id);
    return this.toDto(updated);
  }

  private async require(orgId: string, id: string) {
    const item = await this.prisma.db.complianceItem.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("That compliance item was not found.");
    return item;
  }

  private toDto(item: {
    id: string;
    kind: ComplianceKind;
    title: string;
    description: string | null;
    dueAt: Date;
    rrule: string | null;
    lastCompletedAt: Date | null;
    linkedDocumentId: string | null;
    isActive: boolean;
  }) {
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description,
      dueAt: dateOnlyOut(item.dueAt),
      rrule: item.rrule,
      lastCompletedAt: iso(item.lastCompletedAt),
      linkedDocumentId: item.linkedDocumentId,
      isActive: item.isActive,
    };
  }
}
