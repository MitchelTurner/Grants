import { Injectable, NotFoundException } from "@nestjs/common";
import { countWords, type ContentCategory } from "@se-grants/shared";
import { cursorFilter, encodeCursor } from "../../common/http/pagination";
import { iso } from "../../common/http/values";
import { PrismaService } from "../../common/prisma/prisma.service";

const REVIEW_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, cursor?: string, limit = 25) {
    const rows = await this.prisma.db.contentBlock.findMany({
      where: { organizationId: orgId, deletedAt: null, ...(cursorFilter(cursor) ?? {}) },
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
    userId: string,
    input: { category: ContentCategory; title: string; body: string },
  ) {
    const block = await this.prisma.db.contentBlock.create({
      data: {
        organizationId: orgId,
        category: input.category,
        title: input.title,
        body: input.body,
        wordCount: countWords(input.body),
        charCount: input.body.length,
        createdById: userId,
        updatedById: userId,
        versions: {
          create: { version: 1, title: input.title, body: input.body, editedById: userId },
        },
      },
    });
    return this.toDto(block);
  }

  async get(orgId: string, id: string) {
    return this.toDto(await this.require(orgId, id));
  }

  async update(
    orgId: string,
    id: string,
    userId: string,
    input: { category?: ContentCategory; title?: string; body?: string; markReviewed?: boolean },
  ) {
    const current = await this.require(orgId, id);
    const title = input.title ?? current.title;
    const body = input.body ?? current.body;
    const changed = title !== current.title || body !== current.body;
    const version = changed ? current.version + 1 : current.version;
    const block = await this.prisma.db.contentBlock.update({
      where: { id },
      data: {
        category: input.category,
        title,
        body,
        wordCount: countWords(body),
        charCount: body.length,
        version,
        updatedById: userId,
        lastReviewedAt: input.markReviewed ? new Date() : undefined,
        versions: changed ? { create: { version, title, body, editedById: userId } } : undefined,
      },
    });
    return this.toDto(block);
  }

  async remove(orgId: string, id: string) {
    await this.require(orgId, id);
    await this.prisma.db.contentBlock.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async versions(orgId: string, id: string) {
    await this.require(orgId, id);
    const rows = await this.prisma.db.contentBlockVersion.findMany({
      where: { contentBlockId: id },
      orderBy: { version: "desc" },
    });
    return rows.map((row) => ({
      version: row.version,
      title: row.title,
      body: row.body,
      editedById: row.editedById,
      createdAt: iso(row.createdAt),
    }));
  }

  async restore(orgId: string, id: string, version: number, userId: string) {
    await this.require(orgId, id);
    const snapshot = await this.prisma.db.contentBlockVersion.findUnique({
      where: { contentBlockId_version: { contentBlockId: id, version } },
    });
    if (!snapshot) throw new NotFoundException("That version was not found.");
    return this.update(orgId, id, userId, { title: snapshot.title, body: snapshot.body });
  }

  private async require(orgId: string, id: string) {
    const block = await this.prisma.db.contentBlock.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!block) throw new NotFoundException("That content block was not found.");
    return block;
  }

  private toDto(block: {
    id: string;
    category: ContentCategory;
    title: string;
    body: string;
    wordCount: number;
    charCount: number;
    lastReviewedAt: Date;
    version: number;
    updatedAt: Date;
  }) {
    return {
      id: block.id,
      category: block.category,
      title: block.title,
      body: block.body,
      wordCount: block.wordCount,
      charCount: block.charCount,
      lastReviewedAt: iso(block.lastReviewedAt),
      needsReview: Date.now() - block.lastReviewedAt.getTime() > REVIEW_MS,
      version: block.version,
      updatedAt: iso(block.updatedAt),
    };
  }
}
