import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PlatformRole } from "@se-grants/shared";
import { ENV, type Env } from "../config/env";
import { randomToken, sha256 } from "../crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "./request-context";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(userId: string, meta: { userAgent?: string; ip?: string }): Promise<string> {
    const token = randomToken();
    await this.prisma.db.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + SESSION_MS),
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip?.slice(0, 80),
      },
    });
    return token;
  }

  async resolve(
    token: string | undefined,
  ): Promise<{ user: RequestUser; sessionId: string } | null> {
    if (!token) return null;
    const session = await this.prisma.db.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    const renewAt = Date.now() + SESSION_MS - 24 * 60 * 60 * 1000;
    if (session.expiresAt.getTime() < renewAt) {
      await this.prisma.db.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_MS) },
      });
    }
    return {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        platformRole: session.user.platformRole as PlatformRole,
        timezone: session.user.timezone,
        lastActiveOrgId: session.user.lastActiveOrgId,
        phone: session.user.phone,
        phoneVerifiedAt: session.user.phoneVerifiedAt,
        smsOptIn: session.user.smsOptIn,
      },
    };
  }

  async delete(sessionId: string): Promise<void> {
    await this.prisma.db.session.deleteMany({ where: { id: sessionId } });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.prisma.db.session.deleteMany({ where: { userId } });
  }

  require(user: RequestUser | undefined): RequestUser {
    if (!user) {
      throw new UnauthorizedException("Sign in to continue.");
    }
    return user;
  }

  cookieSecure(): boolean {
    return this.env.APP_URL.startsWith("https://");
  }
}
