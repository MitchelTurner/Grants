import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { packetMissing, type DocumentKind } from "@se-grants/shared";
import { AuditService } from "../../common/audit/audit.service";
import { randomToken } from "../../common/crypto";
import { dateOnlyIn, dateOnlyOut, iso } from "../../common/http/values";
import { cursorFilter, encodeCursor } from "../../common/http/pagination";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService, storageKey } from "../../common/storage/storage.provider";
import { RemindersService } from "../reminders/reminders.service";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/heic"]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
  ) {}

  async uploadUrl(orgId: string, input: { filename: string; mimeType: string; sizeBytes: number }) {
    const key = storageKey(orgId, input.filename);
    const signed = await this.storage.provider.presignPut(key, input.mimeType, input.sizeBytes);
    return { storageKey: key, uploadUrl: signed.url, headers: signed.headers };
  }

  async create(
    orgId: string,
    userId: string,
    input: {
      storageKey: string;
      kind: DocumentKind;
      title: string;
      mimeType: string;
      sizeBytes: number;
      effectiveDate?: string | null;
      expiresAt?: string | null;
      inFunderPacket?: boolean;
      tags?: string[];
    },
  ) {
    if (!input.storageKey.startsWith(`orgs/${orgId}/`)) {
      throw new BadRequestException("That upload does not belong to this organization.");
    }
    const head = await this.storage.provider.head(input.storageKey);
    if (!head) {
      throw new BadRequestException("The file has not finished uploading. Try again.");
    }
    if (head.size !== input.sizeBytes || head.contentType !== input.mimeType) {
      throw new BadRequestException("The uploaded file does not match the size or type you sent.");
    }
    const document = await this.prisma.db.document.create({
      data: {
        organizationId: orgId,
        kind: input.kind,
        title: input.title,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        effectiveDate: input.effectiveDate ? dateOnlyIn(input.effectiveDate) : null,
        expiresAt: input.expiresAt ? dateOnlyIn(input.expiresAt) : null,
        inFunderPacket: input.inFunderPacket ?? false,
        tags: input.tags ?? [],
        uploadedById: userId,
      },
    });
    await this.reminders.syncDocument(document.id);
    return this.toDto(document);
  }

  async list(orgId: string, cursor?: string, limit = 25) {
    const rows = await this.prisma.db.document.findMany({
      where: { organizationId: orgId, deletedAt: null, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const allKinds = await this.prisma.db.document.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { kind: true },
    });
    return {
      items: page.map((row) => this.toDto(row)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
      packetMissing: packetMissing(allKinds.map((row) => row.kind)),
    };
  }

  async update(
    orgId: string,
    id: string,
    input: {
      kind?: DocumentKind;
      title?: string;
      effectiveDate?: string | null;
      expiresAt?: string | null;
      inFunderPacket?: boolean;
      tags?: string[];
    },
  ) {
    await this.require(orgId, id);
    const document = await this.prisma.db.document.update({
      where: { id },
      data: {
        kind: input.kind,
        title: input.title,
        effectiveDate:
          input.effectiveDate === undefined
            ? undefined
            : input.effectiveDate
              ? dateOnlyIn(input.effectiveDate)
              : null,
        expiresAt:
          input.expiresAt === undefined
            ? undefined
            : input.expiresAt
              ? dateOnlyIn(input.expiresAt)
              : null,
        inFunderPacket: input.inFunderPacket,
        tags: input.tags,
      },
    });
    await this.reminders.syncDocument(document.id);
    return this.toDto(document);
  }

  async remove(orgId: string, id: string) {
    await this.require(orgId, id);
    await this.prisma.db.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.reminders.syncDocument(id);
  }

  async downloadUrl(orgId: string, id: string, userId: string, ip?: string) {
    const document = await this.require(orgId, id);
    const attachment = !IMAGE_TYPES.has(document.mimeType);
    const url = await this.storage.provider.presignGet(
      document.storageKey,
      document.title,
      attachment,
    );
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "document.download",
      entityType: "Document",
      entityId: document.id,
      ip,
    });
    return { url, expiresInSeconds: 300 };
  }

  private async require(orgId: string, id: string) {
    const document = await this.prisma.db.document.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!document) throw new NotFoundException("That document was not found.");
    return document;
  }

  private toDto(document: {
    id: string;
    kind: DocumentKind;
    title: string;
    mimeType: string;
    sizeBytes: number;
    effectiveDate: Date | null;
    expiresAt: Date | null;
    inFunderPacket: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: document.id,
      kind: document.kind,
      title: document.title,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      effectiveDate: dateOnlyOut(document.effectiveDate),
      expiresAt: dateOnlyOut(document.expiresAt),
      inFunderPacket: document.inFunderPacket,
      tags: document.tags,
      createdAt: iso(document.createdAt),
      updatedAt: iso(document.updatedAt),
    };
  }
}

function cursorWhere(cursor: string | undefined) {
  const filter = cursorFilter(cursor);
  return filter ?? {};
}

export function newStorageId(): string {
  return randomToken(8);
}
