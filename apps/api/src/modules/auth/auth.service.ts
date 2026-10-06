import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isValidTimeZone } from "@se-grants/shared";
import { ENV, type Env } from "../../common/config/env";
import { maskEmail, randomCode, randomToken, safeEqual, sha256 } from "../../common/crypto";
import { MailService } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { SessionService } from "../../common/auth/session.service";
import { SmsService } from "../../common/sms/sms.provider";
import type { RequestUser } from "../../common/auth/request-context";

const LOGIN_TTL_MS = 15 * 60 * 1000;
const PHONE_TTL_SECONDS = 10 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async requestLogin(email: string, ip: string | undefined): Promise<void> {
    const ipLimit = this.env.NODE_ENV === "test" ? 500 : 20;
    const ipKey = `rl:login:ip:${ip ?? "unknown"}`;
    const emailKey = `rl:login:email:${email}`;
    const ipCount = await this.redis.increment(ipKey, 15 * 60);
    const emailCount = await this.redis.increment(emailKey, 15 * 60);
    if (ipCount > ipLimit || emailCount > 5) {
      throw new HttpException(
        "Too many sign-in requests. Wait a few minutes and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = randomToken();
    const code = randomCode();
    await this.prisma.db.loginToken.create({
      data: {
        email,
        tokenHash: sha256(token),
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + LOGIN_TTL_MS),
      },
    });
    const link = `${this.env.APP_URL}/api/v1/auth/verify?token=${encodeURIComponent(token)}`;
    await this.mail.send({
      to: email,
      subject: "Your Southeast Grants sign-in code",
      text: `Your sign-in code is ${code}. It expires in 15 minutes.\n\nOr open this link on the same device:\n${link}\n`,
    });
  }

  async verifyCode(
    email: string,
    code: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<string> {
    const token = await this.prisma.db.loginToken.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!token || token.attempts >= 5) {
      throw new BadRequestException("That code has expired. Request a new one.");
    }
    if (!safeEqual(token.codeHash, sha256(code))) {
      const attempts = token.attempts + 1;
      await this.prisma.db.loginToken.update({
        where: { id: token.id },
        data: { attempts, usedAt: attempts >= 5 ? new Date() : null },
      });
      throw new BadRequestException(
        attempts >= 5
          ? "That code has expired. Request a new one."
          : "That code does not match. Try again.",
      );
    }
    await this.prisma.db.loginToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    const user = await this.finishSignIn(email);
    return this.sessions.create(user.id, meta);
  }

  async verifyLink(
    token: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<string | null> {
    const row = await this.prisma.db.loginToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await this.prisma.db.loginToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const user = await this.finishSignIn(row.email);
    return this.sessions.create(user.id, meta);
  }

  private async finishSignIn(email: string) {
    const existing = await this.prisma.db.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await this.prisma.db.user.create({
        data: { email, notificationPref: { create: {} } },
      }));
    await this.acceptPendingInvitations(user.id, email);
    return user;
  }

  private async acceptPendingInvitations(userId: string, email: string): Promise<void> {
    const invites = await this.prisma.db.invitation.findMany({
      where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    for (const invite of invites) {
      await this.prisma.db.membership.upsert({
        where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
        create: { userId, organizationId: invite.organizationId, role: invite.role },
        update: {},
      });
      await this.prisma.db.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    }
  }

  async me(user: RequestUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt != null,
      smsOptIn: user.smsOptIn,
      timezone: user.timezone,
      platformRole: user.platformRole,
      lastActiveOrgId: user.lastActiveOrgId,
      hasCalendarFeed: await this.hasCalendar(user.id),
    };
  }

  private async hasCalendar(userId: string): Promise<boolean> {
    const row = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { calendarTokenHash: true },
    });
    return Boolean(row?.calendarTokenHash);
  }

  async updateMe(
    user: RequestUser,
    input: { name?: string | null; timezone?: string; lastActiveOrgId?: string | null },
  ) {
    if (input.timezone && !isValidTimeZone(input.timezone)) {
      throw new BadRequestException("Choose a time zone from the list.");
    }
    if (input.lastActiveOrgId) {
      const membership = await this.prisma.db.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId: input.lastActiveOrgId },
        },
        include: { organization: true },
      });
      if (!membership || membership.organization.deletedAt) {
        throw new HttpException("That organization was not found.", HttpStatus.NOT_FOUND);
      }
    }
    const updated = await this.prisma.db.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        timezone: input.timezone,
        lastActiveOrgId: input.lastActiveOrgId,
      },
    });
    return this.me({
      ...user,
      name: updated.name,
      timezone: updated.timezone,
      lastActiveOrgId: updated.lastActiveOrgId,
    });
  }

  async sendPhoneCode(user: RequestUser, phone: string): Promise<void> {
    const code = randomCode();
    await this.redis.put(
      `phone:${user.id}`,
      JSON.stringify({ phone, codeHash: sha256(code), attempts: 0 }),
      PHONE_TTL_SECONDS,
    );
    await this.sms.send({
      to: phone,
      body: `Southeast Grants code: ${code}. It expires in 10 minutes.`,
    });
  }

  async verifyPhone(user: RequestUser, code: string): Promise<void> {
    const raw = await this.redis.read(`phone:${user.id}`);
    if (!raw) {
      throw new BadRequestException("That code has expired. Request a new one.");
    }
    const parsed = JSON.parse(raw) as { phone: string; codeHash: string; attempts: number };
    if (parsed.attempts >= 5) {
      throw new BadRequestException("That code has expired. Request a new one.");
    }
    if (!safeEqual(parsed.codeHash, sha256(code))) {
      parsed.attempts += 1;
      await this.redis.put(`phone:${user.id}`, JSON.stringify(parsed), PHONE_TTL_SECONDS);
      throw new BadRequestException("That code does not match. Try again.");
    }
    await this.redis.remove(`phone:${user.id}`);
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { phone: parsed.phone, phoneVerifiedAt: new Date(), smsOptIn: true },
    });
  }

  async notifications(userId: string) {
    const pref = await this.prisma.db.notificationPreference.findUnique({ where: { userId } });
    return {
      emailEnabled: pref?.emailEnabled ?? true,
      smsEnabled: pref?.smsEnabled ?? false,
      weeklyDigest: pref?.weeklyDigest ?? true,
      digestWeekday: pref?.digestWeekday ?? 1,
      digestHour: pref?.digestHour ?? 8,
      reminderOffsets: pref?.reminderOffsets ?? [30, 14, 7, 2, 1],
      quietStartHour: pref?.quietStartHour ?? 21,
      quietEndHour: pref?.quietEndHour ?? 8,
    };
  }

  async updateNotifications(
    userId: string,
    input: Partial<Awaited<ReturnType<AuthService["notifications"]>>>,
  ) {
    await this.prisma.db.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return this.notifications(userId);
  }

  async rotateCalendar(userId: string): Promise<{ url: string }> {
    const token = randomToken();
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { calendarTokenHash: sha256(token) },
    });
    return { url: `${this.env.APP_URL}/api/v1/calendar/feed/${token}.ics` };
  }

  async userIdForCalendarToken(token: string): Promise<string | null> {
    const user = await this.prisma.db.user.findUnique({
      where: { calendarTokenHash: sha256(token) },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  mask(email: string): string {
    return maskEmail(email);
  }
}
