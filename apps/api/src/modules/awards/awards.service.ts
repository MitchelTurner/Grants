import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { BudgetCategory } from "@se-grants/db";
import {
  addMoney,
  compareMoney,
  dateInRange,
  fiscalYearContaining,
  formatMoney,
  multiplyMoney,
  subtractMoney,
  todayDate,
} from "@se-grants/shared";
import { AuditService } from "../../common/audit/audit.service";
import { dateOnlyIn, dateOnlyOut, iso, moneyOut } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService, storageKey } from "../../common/storage/storage.provider";
import { RemindersService } from "../reminders/reminders.service";

type AwardInput = {
  applicationId: string;
  amount: string;
  startDate: string;
  endDate: string;
  paymentType: "ADVANCE" | "REIMBURSEMENT" | "MIXED";
  isFederal: boolean;
  assistanceListing: string | null;
  matchRequiredAmount: string | null;
  restrictions: string | null;
  agreementDocumentId: string | null;
};

@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
    private readonly storage: StorageService,
  ) {}

  async list(orgId: string) {
    const rows = await this.prisma.db.award.findMany({
      where: { organizationId: orgId },
      include: { application: true },
      orderBy: { startDate: "desc" },
    });
    return { items: rows.map((row) => this.awardDto(row)) };
  }

  async create(orgId: string, userId: string, input: AwardInput, ip?: string) {
    if (input.endDate < input.startDate) {
      throw new BadRequestException("The end date is before the start date.");
    }
    const application = await this.prisma.db.application.findFirst({
      where: { id: input.applicationId, organizationId: orgId, deletedAt: null },
    });
    if (!application || application.status !== "AWARDED") {
      throw new BadRequestException("Mark the application awarded before setting up the award.");
    }
    const existing = await this.prisma.db.award.findUnique({
      where: { applicationId: application.id },
    });
    if (existing) throw new BadRequestException("This application already has an award.");
    await this.ownDocument(orgId, input.agreementDocumentId);
    const award = await this.prisma.db.award.create({
      data: {
        organizationId: orgId,
        applicationId: application.id,
        amount: input.amount,
        startDate: dateOnlyIn(input.startDate),
        endDate: dateOnlyIn(input.endDate),
        paymentType: input.paymentType,
        isFederal: input.isFederal,
        assistanceListing: input.assistanceListing,
        matchRequiredAmount: input.matchRequiredAmount,
        restrictions: input.restrictions,
        agreementDocumentId: input.agreementDocumentId,
      },
      include: { application: true },
    });
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "award.create",
      entityType: "Award",
      entityId: award.id,
      ip,
    });
    return this.awardDto(award);
  }

  async get(orgId: string, awardId: string) {
    const award = await this.requireAward(orgId, awardId);
    const [lines, spend, requests, reports, metrics, matches] = await Promise.all([
      this.prisma.db.budgetLine.findMany({ where: { awardId }, orderBy: { description: "asc" } }),
      this.prisma.db.expenditure.findMany({ where: { awardId }, orderBy: { date: "desc" } }),
      this.prisma.db.reimbursementRequest.findMany({
        where: { awardId },
        orderBy: { periodStart: "desc" },
      }),
      this.prisma.db.reportRequirement.findMany({ where: { awardId }, orderBy: { dueAt: "asc" } }),
      this.prisma.db.metric.findMany({
        where: { awardId },
        include: { entries: { orderBy: { date: "desc" } } },
      }),
      this.prisma.db.matchEntry.findMany({ where: { awardId }, orderBy: { date: "desc" } }),
    ]);
    const spentByLine = new Map<string, string[]>();
    for (const row of spend) {
      const bucket = spentByLine.get(row.budgetLineId) ?? [];
      bucket.push(moneyOut(row.amount) ?? "0");
      spentByLine.set(row.budgetLineId, bucket);
    }
    return {
      ...this.awardDto(award),
      budgetLines: lines.map((line) => ({
        id: line.id,
        category: line.category,
        description: line.description,
        budgeted: moneyOut(line.budgeted),
        isMatch: line.isMatch,
        spent: addMoney(spentByLine.get(line.id) ?? []),
      })),
      expenditures: spend.map((row) => ({
        id: row.id,
        budgetLineId: row.budgetLineId,
        date: dateOnlyOut(row.date),
        amount: moneyOut(row.amount),
        vendor: row.vendor,
        description: row.description,
        receiptDocumentId: row.receiptDocumentId,
        reimbursementRequestId: row.reimbursementRequestId,
      })),
      reimbursements: requests.map((row) => ({
        id: row.id,
        periodStart: dateOnlyOut(row.periodStart),
        periodEnd: dateOnlyOut(row.periodEnd),
        amount: moneyOut(row.amount),
        status: row.status,
        submittedAt: iso(row.submittedAt),
        expectedPaidAt: iso(row.expectedPaidAt),
        paidAt: iso(row.paidAt),
      })),
      reports: reports.map((row) => ({
        id: row.id,
        kind: row.kind,
        dueAt: iso(row.dueAt),
        periodStart: dateOnlyOut(row.periodStart),
        periodEnd: dateOnlyOut(row.periodEnd),
        status: row.status,
        submittedAt: iso(row.submittedAt),
        generatedDocumentId: row.generatedDocumentId,
      })),
      metrics: metrics.map((metric) => ({
        id: metric.id,
        name: metric.name,
        target: moneyOut(metric.target),
        unit: metric.unit,
        entries: metric.entries.map((entry) => ({
          id: entry.id,
          value: moneyOut(entry.value),
          date: dateOnlyOut(entry.date),
          note: entry.note,
        })),
      })),
      matchLogged: addMoney(matches.map((row) => moneyOut(row.inKindValue))),
      forecast: this.forecast(award.paymentType, spend, requests),
    };
  }

  async addBudgetLine(
    orgId: string,
    awardId: string,
    input: { category: string; description: string; budgeted: string; isMatch: boolean },
  ) {
    await this.requireAward(orgId, awardId);
    const line = await this.prisma.db.budgetLine.create({
      data: {
        awardId,
        category: input.category as BudgetCategory,
        description: input.description,
        budgeted: input.budgeted,
        isMatch: input.isMatch,
      },
    });
    return { id: line.id };
  }

  async addExpenditure(
    orgId: string,
    awardId: string,
    input: {
      budgetLineId: string;
      date: string;
      amount: string;
      vendor: string;
      description: string;
      receiptDocumentId: string | null;
    },
  ) {
    await this.requireAward(orgId, awardId);
    const line = await this.prisma.db.budgetLine.findFirst({
      where: { id: input.budgetLineId, awardId },
    });
    if (!line) throw new BadRequestException("Choose a budget line on this award.");
    await this.ownDocument(orgId, input.receiptDocumentId);
    const row = await this.prisma.db.expenditure.create({
      data: {
        awardId,
        budgetLineId: line.id,
        date: dateOnlyIn(input.date),
        amount: input.amount,
        vendor: input.vendor,
        description: input.description,
        receiptDocumentId: input.receiptDocumentId,
      },
    });
    return { id: row.id };
  }

  async addReimbursement(
    orgId: string,
    awardId: string,
    input: {
      periodStart: string;
      periodEnd: string;
      amount: string;
      status: "DRAFT" | "SUBMITTED" | "PAID" | "CANCELED";
      expectedPaidAt: string | null;
      expenditureIds: string[];
    },
  ) {
    await this.requireAward(orgId, awardId);
    if (input.periodEnd < input.periodStart) {
      throw new BadRequestException("The period ends before it starts.");
    }
    const rows = await this.prisma.db.expenditure.findMany({
      where: { id: { in: input.expenditureIds }, awardId },
    });
    if (rows.length !== input.expenditureIds.length) {
      throw new BadRequestException("Each receipt has to belong to this award.");
    }
    const blocked = rows.find((row) => row.reimbursementRequestId);
    if (blocked) {
      throw new BadRequestException("One of those receipts is already on a request.");
    }
    const now = new Date();
    const request = await this.prisma.db.reimbursementRequest.create({
      data: {
        awardId,
        periodStart: dateOnlyIn(input.periodStart),
        periodEnd: dateOnlyIn(input.periodEnd),
        amount: input.amount,
        status: input.status,
        expectedPaidAt: input.expectedPaidAt ? new Date(input.expectedPaidAt) : null,
        submittedAt: input.status === "SUBMITTED" || input.status === "PAID" ? now : null,
        paidAt: input.status === "PAID" ? now : null,
      },
    });
    if (input.expenditureIds.length > 0) {
      await this.prisma.db.expenditure.updateMany({
        where: { id: { in: input.expenditureIds }, awardId },
        data: { reimbursementRequestId: request.id },
      });
    }
    return { id: request.id };
  }

  async addReport(
    orgId: string,
    awardId: string,
    input: {
      kind: "PROGRESS" | "FINANCIAL" | "FINAL" | "OTHER";
      dueAt: string;
      periodStart: string;
      periodEnd: string;
    },
  ) {
    await this.requireAward(orgId, awardId);
    const report = await this.prisma.db.reportRequirement.create({
      data: {
        awardId,
        kind: input.kind,
        dueAt: new Date(input.dueAt),
        periodStart: dateOnlyIn(input.periodStart),
        periodEnd: dateOnlyIn(input.periodEnd),
      },
    });
    await this.reminders.syncReport(report.id);
    return { id: report.id };
  }

  async generateReport(orgId: string, userId: string, awardId: string, reportId: string) {
    const award = await this.requireAward(orgId, awardId);
    const report = await this.prisma.db.reportRequirement.findFirst({
      where: { id: reportId, awardId },
    });
    if (!report) throw new NotFoundException("That report was not found.");
    const org = await this.prisma.db.organization.findUnique({ where: { id: orgId } });
    const [lines, spend, metrics, matches] = await Promise.all([
      this.prisma.db.budgetLine.findMany({ where: { awardId } }),
      this.prisma.db.expenditure.findMany({ where: { awardId } }),
      this.prisma.db.metric.findMany({ where: { awardId }, include: { entries: true } }),
      this.prisma.db.matchEntry.findMany({ where: { awardId } }),
    ]);
    const start = dateOnlyOut(report.periodStart) ?? "";
    const end = dateOnlyOut(report.periodEnd) ?? "";
    const inPeriod = spend.filter((row) => {
      const day = dateOnlyOut(row.date) ?? "";
      return dateInRange(day, start, end);
    });
    const text = [
      `${org?.name ?? "Organization"} — ${reportKindLabel(report.kind)} report`,
      `Award: ${award.application.title}`,
      `Period: ${start} to ${end}`,
      `Awarded: ${formatMoney(moneyOut(award.amount))}`,
      `Spent in this period: ${formatMoney(addMoney(inPeriod.map((row) => moneyOut(row.amount))))}`,
      `Match logged on this award: ${formatMoney(addMoney(matches.map((row) => moneyOut(row.inKindValue))))}`,
      award.matchRequiredAmount
        ? `Match required: ${formatMoney(moneyOut(award.matchRequiredAmount))}`
        : "Match required: not set",
      "",
      "Budget",
      ...lines.map((line) => {
        const spent = addMoney(
          spend.filter((row) => row.budgetLineId === line.id).map((row) => moneyOut(row.amount)),
        );
        return `${line.description} (${categoryLabel(line.category)}): budgeted ${formatMoney(moneyOut(line.budgeted))}, spent ${formatMoney(spent)}${line.isMatch ? ", match" : ""}`;
      }),
      "",
      "Measures",
      ...metrics.map((metric) => {
        const latest = metric.entries
          .filter((entry) => dateInRange(dateOnlyOut(entry.date) ?? "", start, end))
          .sort((left, right) =>
            (dateOnlyOut(left.date) ?? "").localeCompare(dateOnlyOut(right.date) ?? ""),
          )
          .at(-1);
        return `${metric.name}: ${latest ? moneyOut(latest.value) : "no entry this period"} / ${moneyOut(metric.target)} ${metric.unit}`;
      }),
      "",
      "This file is a draft for your records. Mark the report submitted only after the funder has it.",
    ].join("\n");
    const filename = `${award.application.title} report.txt`;
    const key = storageKey(orgId, filename);
    const body = Buffer.from(text, "utf8");
    await this.storage.provider.put(key, body, "text/plain");
    const document = await this.prisma.db.document.create({
      data: {
        organizationId: orgId,
        kind: "GRANT_REPORT",
        title: filename,
        storageKey: key,
        mimeType: "text/plain",
        sizeBytes: body.length,
        uploadedById: userId,
      },
    });
    await this.prisma.db.reportRequirement.update({
      where: { id: report.id },
      data: { generatedDocumentId: document.id },
    });
    return { documentId: document.id };
  }

  async submitReport(orgId: string, reportId: string, awardId: string) {
    const report = await this.prisma.db.reportRequirement.findFirst({
      where: { id: reportId, awardId, award: { organizationId: orgId } },
    });
    if (!report) throw new NotFoundException("That report was not found.");
    await this.prisma.db.reportRequirement.update({
      where: { id: report.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await this.reminders.syncReport(report.id);
    return { ok: true };
  }

  async addMetric(
    orgId: string,
    awardId: string,
    input: { name: string; target: string; unit: string },
  ) {
    await this.requireAward(orgId, awardId);
    const metric = await this.prisma.db.metric.create({
      data: { awardId, name: input.name, target: input.target, unit: input.unit },
    });
    return { id: metric.id };
  }

  async addMetricEntry(
    orgId: string,
    awardId: string,
    metricId: string,
    input: { value: string; date: string; note: string },
  ) {
    const metric = await this.prisma.db.metric.findFirst({
      where: { id: metricId, awardId, award: { organizationId: orgId } },
    });
    if (!metric) throw new NotFoundException("That measure was not found.");
    const entry = await this.prisma.db.metricEntry.create({
      data: { metricId, value: input.value, date: dateOnlyIn(input.date), note: input.note },
    });
    return { id: entry.id };
  }

  async federalSpend(orgId: string) {
    const org = await this.prisma.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("That organization was not found.");
    const today = todayDate(org.timezone);
    const year = fiscalYearContaining(org.fiscalYearStartMonth, today);
    const setting = await this.prisma.db.platformSetting.findUnique({
      where: { key: "SINGLE_AUDIT_THRESHOLD_USD" },
    });
    const threshold =
      setting?.value && /^\d+(\.\d{1,2})?$/.test(setting.value) ? setting.value : "1000000";
    const spend = await this.prisma.db.expenditure.findMany({
      where: { award: { organizationId: orgId, isFederal: true } },
    });
    const federalSpent = addMoney(
      spend
        .filter((row) => dateInRange(dateOnlyOut(row.date) ?? "", year.start, year.end))
        .map((row) => moneyOut(row.amount)),
    );
    return {
      fiscalYearLabel: year.label,
      start: year.start,
      end: year.end,
      federalSpent,
      threshold,
      over: compareMoney(federalSpent, threshold) > 0,
      remaining: subtractMoney(threshold, federalSpent),
    };
  }

  async logMatch(
    orgId: string,
    userId: string,
    input: {
      awardId: string | null;
      volunteerName: string;
      date: string;
      hours: string | null;
      inKindValue: string | null;
      rate: string | null;
      description: string;
      photoDocumentIds: string[];
      lat: number | null;
      lng: number | null;
      clientId: string;
    },
  ) {
    const existing = await this.prisma.db.matchEntry.findUnique({
      where: { clientId: input.clientId },
    });
    if (existing) {
      if (existing.organizationId !== orgId) {
        throw new NotFoundException("That organization was not found.");
      }
      return { id: existing.id, duplicate: true };
    }
    if (input.awardId) await this.requireAward(orgId, input.awardId);
    for (const documentId of input.photoDocumentIds) {
      await this.ownDocument(orgId, documentId);
    }
    let rate = input.rate;
    if (!rate) {
      const setting = await this.prisma.db.platformSetting.findUnique({
        where: { key: "VOLUNTEER_HOUR_RATE_USD" },
      });
      rate = setting?.value && /^\d+(\.\d{1,2})?$/.test(setting.value) ? setting.value : null;
    }
    const inKind =
      input.inKindValue ?? (input.hours && rate ? multiplyMoney(input.hours, rate) : null);
    const row = await this.prisma.db.matchEntry.create({
      data: {
        organizationId: orgId,
        awardId: input.awardId,
        userId,
        volunteerName: input.volunteerName,
        date: dateOnlyIn(input.date),
        hours: input.hours,
        inKindValue: inKind,
        rate,
        description: input.description,
        photoDocumentIds: input.photoDocumentIds,
        lat: input.lat,
        lng: input.lng,
        clientId: input.clientId,
      },
    });
    return { id: row.id, duplicate: false };
  }

  async listMatches(orgId: string) {
    const rows = await this.prisma.db.matchEntry.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "desc" },
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        awardId: row.awardId,
        volunteerName: row.volunteerName,
        date: dateOnlyOut(row.date),
        hours: moneyOut(row.hours),
        inKindValue: moneyOut(row.inKindValue),
        rate: moneyOut(row.rate),
        description: row.description,
        clientId: row.clientId,
      })),
      volunteerRate: await this.volunteerRate(),
    };
  }

  async addInteraction(
    orgId: string,
    input: {
      funderId: string | null;
      contactName: string;
      contactEmail: string | null;
      date: string;
      type: "CALL" | "EMAIL" | "MEETING" | "SITE_VISIT";
      summary: string;
      followUpAt: string | null;
    },
  ) {
    if (input.funderId) {
      const funder = await this.prisma.db.funder.findUnique({ where: { id: input.funderId } });
      if (!funder) throw new BadRequestException("Choose a funder from the directory.");
    }
    const row = await this.prisma.db.funderInteraction.create({
      data: {
        organizationId: orgId,
        funderId: input.funderId,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        date: dateOnlyIn(input.date),
        type: input.type,
        summary: input.summary,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      },
    });
    await this.reminders.syncFollowUp(row.id);
    return { id: row.id };
  }

  async listInteractions(orgId: string) {
    const rows = await this.prisma.db.funderInteraction.findMany({
      where: { organizationId: orgId },
      include: { funder: true },
      orderBy: { date: "desc" },
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        funderId: row.funderId,
        funderName: row.funder?.name ?? null,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        date: dateOnlyOut(row.date),
        type: row.type,
        summary: row.summary,
        followUpAt: iso(row.followUpAt),
      })),
    };
  }

  private forecast(
    paymentType: string,
    spend: Array<{ amount: { toString(): string }; reimbursementRequestId: string | null }>,
    requests: Array<{
      id: string;
      amount: { toString(): string };
      status: string;
      expectedPaidAt: Date | null;
    }>,
  ) {
    if (paymentType === "ADVANCE") {
      return {
        kind: "advance" as const,
        note: "This award is paid up front, so there is no reimbursement waiting to come back.",
        notYetRequested: "0.00",
        awaiting: [] as Array<{ id: string; amount: string | null; expectedPaidAt: string | null }>,
      };
    }
    const notYetRequested = addMoney(
      spend.filter((row) => !row.reimbursementRequestId).map((row) => moneyOut(row.amount)),
    );
    return {
      kind: "reimbursement" as const,
      note: "Money comes back after you send receipts. Dates below are the ones you expect the funder to pay.",
      notYetRequested,
      awaiting: requests
        .filter((row) => row.status === "SUBMITTED")
        .map((row) => ({
          id: row.id,
          amount: moneyOut(row.amount),
          expectedPaidAt: iso(row.expectedPaidAt),
        })),
    };
  }

  private async volunteerRate(): Promise<string | null> {
    const setting = await this.prisma.db.platformSetting.findUnique({
      where: { key: "VOLUNTEER_HOUR_RATE_USD" },
    });
    if (!setting?.value || !/^\d+(\.\d{1,2})?$/.test(setting.value)) return null;
    return setting.value;
  }

  private async requireAward(orgId: string, awardId: string) {
    const award = await this.prisma.db.award.findFirst({
      where: { id: awardId, organizationId: orgId },
      include: { application: true },
    });
    if (!award) throw new NotFoundException("That award was not found.");
    return award;
  }

  private async ownDocument(orgId: string, documentId: string | null) {
    if (!documentId) return;
    const document = await this.prisma.db.document.findFirst({
      where: { id: documentId, organizationId: orgId, deletedAt: null },
    });
    if (!document) throw new BadRequestException("That file is not in this organization's vault.");
  }

  private awardDto(award: {
    id: string;
    applicationId: string;
    amount: { toString(): string };
    startDate: Date;
    endDate: Date;
    paymentType: string;
    isFederal: boolean;
    assistanceListing: string | null;
    matchRequiredAmount: { toString(): string } | null;
    restrictions: string | null;
    agreementDocumentId: string | null;
    application: { title: string; status: string };
  }) {
    return {
      id: award.id,
      applicationId: award.applicationId,
      title: award.application.title,
      amount: moneyOut(award.amount),
      startDate: dateOnlyOut(award.startDate),
      endDate: dateOnlyOut(award.endDate),
      paymentType: award.paymentType,
      isFederal: award.isFederal,
      assistanceListing: award.assistanceListing,
      matchRequiredAmount: moneyOut(award.matchRequiredAmount),
      restrictions: award.restrictions,
      agreementDocumentId: award.agreementDocumentId,
    };
  }
}

function reportKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    PROGRESS: "Progress",
    FINANCIAL: "Financial",
    FINAL: "Final",
    OTHER: "Other",
  };
  return labels[kind] ?? "Report";
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    PERSONNEL: "Personnel",
    FRINGE: "Fringe",
    TRAVEL: "Travel",
    FREIGHT: "Freight",
    EQUIPMENT: "Equipment",
    SUPPLIES: "Supplies",
    CONTRACTUAL: "Contractual",
    CONSTRUCTION: "Construction",
    OTHER: "Other",
    INDIRECT: "Indirect",
  };
  return labels[category] ?? "Other";
}
