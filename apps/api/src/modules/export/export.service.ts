import { Injectable } from "@nestjs/common";
import archiver from "archiver";
import { AuditService } from "../../common/audit/audit.service";
import { QueueService } from "../../common/jobs/queue.service";
import { MailService } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.provider";
import { moneyOut, dateOnlyOut } from "../../common/http/values";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";

const RETAIN_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async request(orgId: string, userId: string, ip?: string) {
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "org.export",
      entityType: "Organization",
      entityId: orgId,
      ip,
    });
    await this.queue.enqueue(
      "orgs:export",
      { orgId, userId },
      { jobId: `export-${orgId}-${Date.now()}` },
    );
    return { queued: true };
  }

  async build(orgId: string, userId: string): Promise<void> {
    const org = await this.prisma.db.organization.findUnique({ where: { id: orgId } });
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!org || !user) return;
    const [
      members,
      documents,
      blocks,
      versions,
      applications,
      checklist,
      compliance,
      watches,
      reminders,
      audits,
    ] = await Promise.all([
      this.prisma.db.membership.findMany({
        where: { organizationId: orgId },
        include: { user: true },
      }),
      this.prisma.db.document.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.contentBlock.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.contentBlockVersion.findMany({
        where: { contentBlock: { organizationId: orgId } },
      }),
      this.prisma.db.application.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.checklistItem.findMany({ where: { application: { organizationId: orgId } } }),
      this.prisma.db.complianceItem.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.opportunityWatch.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.reminder.findMany({ where: { organizationId: orgId } }),
      this.prisma.db.auditLog.findMany({ where: { organizationId: orgId } }),
    ]);
    const payload = {
      organization: { ...org, annualBudget: moneyOut(org.annualBudget) },
      members: members.map((row) => ({
        role: row.role,
        email: row.user.email,
        name: row.user.name,
      })),
      documents: documents.map((row) => ({
        ...row,
        effectiveDate: dateOnlyOut(row.effectiveDate),
        expiresAt: dateOnlyOut(row.expiresAt),
      })),
      contentBlocks: blocks,
      contentBlockVersions: versions,
      applications: applications.map((row) => ({
        ...row,
        amountRequested: moneyOut(row.amountRequested),
        amountAwarded: moneyOut(row.amountAwarded),
      })),
      checklist,
      compliance: compliance.map((row) => ({ ...row, dueAt: dateOnlyOut(row.dueAt) })),
      watches,
      reminders,
      auditLogs: audits,
    };
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
    });
    archive.append(JSON.stringify(payload, null, 2), { name: "organization.json" });
    for (const document of documents) {
      const file = await this.storage.provider.get(document.storageKey);
      if (file) {
        archive.append(file.body, { name: `files/${document.title.replaceAll("/", "-")}` });
      }
    }
    await archive.finalize();
    const zip = await done;
    const key = `exports/${orgId}/${Date.now()}.zip`;
    await this.storage.provider.put(key, zip, "application/zip");
    const url = await this.storage.provider.presignGet(
      key,
      `${org.slug}-export.zip`,
      true,
      7 * 24 * 60 * 60,
    );
    await this.mail.send({
      to: user.email,
      subject: `Export for ${org.name}`,
      text: `Your export is ready for 7 days:\n${url}\n`,
    });
  }

  async hardDelete(): Promise<number> {
    const cutoff = new Date(Date.now() - RETAIN_MS);
    const documents = await this.prisma.db.document.findMany({
      where: { deletedAt: { lt: cutoff } },
    });
    for (const document of documents) {
      await this.storage.provider.delete(document.storageKey);
      await this.prisma.db.document.delete({ where: { id: document.id } });
    }
    await this.prisma.db.contentBlock.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await this.prisma.db.application.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    const orgs = await this.prisma.db.organization.findMany({
      where: { deletedAt: { lt: cutoff } },
    });
    for (const org of orgs) {
      const files = await this.prisma.db.document.findMany({ where: { organizationId: org.id } });
      for (const file of files) {
        await this.storage.provider.delete(file.storageKey);
      }
      await this.prisma.db.organization.delete({ where: { id: org.id } });
    }
    return documents.length + orgs.length;
  }
}
