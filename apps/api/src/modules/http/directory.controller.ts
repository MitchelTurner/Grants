import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  DigestIssueBody,
  DigestSubscribeBody,
  FunderBody,
  ImportOpportunitiesBody,
  OpportunityBody,
  OpportunityQuery,
  PlatformSettingBody,
  UserLookupQuery,
} from "@se-grants/shared";
import type { Response } from "express";
import {
  AuthGuard,
  CsrfGuard,
  OrgMemberGuard,
  PlatformGuard,
  RequirePlatform,
  RequireRole,
} from "../../common/auth/guards";
import {
  CurrentOrg,
  CurrentUser,
  type AppRequest,
  type RequestOrg,
  type RequestUser,
} from "../../common/auth/request-context";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";
import { parseInput } from "../../common/http/parse";
import { EMAIL, isMemoryEmail, type EmailProvider } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DigestService } from "../digest/digest.service";
import { DirectoryService } from "../directory/directory.service";

@Controller()
@UseGuards(AuthGuard, CsrfGuard)
export class DirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("opportunities")
  async list(@CurrentUser() user: RequestUser | undefined, @Query() query: unknown) {
    const input = parseInput(OpportunityQuery, query);
    const memberships = user
      ? await this.prisma.db.membership.findMany({
          where: { userId: user.id, organization: { deletedAt: null } },
          select: { organizationId: true },
        })
      : [];
    return this.directory.listOpportunities({
      admin: user?.platformRole === "CURATOR" || user?.platformRole === "SUPERADMIN",
      viewerTimeZone: user?.timezone ?? "America/Juneau",
      query: input,
      memberOrgIds: memberships.map((row) => row.organizationId),
    });
  }

  @Get("opportunities/:slug")
  async one(
    @CurrentUser() user: RequestUser | undefined,
    @Param("slug") slug: string,
    @Query("fitForOrgId") fitForOrgId?: string,
  ) {
    const memberships = user
      ? await this.prisma.db.membership.findMany({
          where: { userId: user.id },
          select: { organizationId: true },
        })
      : [];
    return this.directory.opportunityBySlug(
      slug,
      user?.platformRole === "CURATOR" || user?.platformRole === "SUPERADMIN",
      user?.timezone ?? "America/Juneau",
      fitForOrgId,
      memberships.map((row) => row.organizationId),
    );
  }

  @Get("funders")
  funders(@CurrentUser() user: RequestUser | undefined, @Query("cursor") cursor?: string) {
    const admin = user?.platformRole === "CURATOR" || user?.platformRole === "SUPERADMIN";
    return this.directory.listFunders(Boolean(admin), cursor);
  }

  @Get("funders/:slug")
  funder(@CurrentUser() user: RequestUser | undefined, @Param("slug") slug: string) {
    const admin = user?.platformRole === "CURATOR" || user?.platformRole === "SUPERADMIN";
    return this.directory.funderBySlug(slug, Boolean(admin));
  }

  @Put("orgs/:orgId/watches/:opportunityId")
  @UseGuards(OrgMemberGuard)
  @RequireRole("EDITOR")
  watch(@CurrentOrg() org: RequestOrg, @Param("opportunityId") opportunityId: string) {
    return this.directory.watch(org.organizationId, opportunityId);
  }

  @Delete("orgs/:orgId/watches/:opportunityId")
  @UseGuards(OrgMemberGuard)
  @RequireRole("EDITOR")
  @HttpCode(200)
  unwatch(@CurrentOrg() org: RequestOrg, @Param("opportunityId") opportunityId: string) {
    return this.directory.unwatch(org.organizationId, opportunityId);
  }
}

@Controller("admin")
@UseGuards(AuthGuard, CsrfGuard, PlatformGuard)
@RequirePlatform("CURATOR")
export class AdminController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly digest: DigestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("funders")
  funders() {
    return this.directory.listFunders(true, undefined, 100);
  }

  @Post("funders")
  createFunder(@Body() body: unknown) {
    return this.directory.createFunder(parseInput(FunderBody, body));
  }

  @Patch("funders/:id")
  updateFunder(@Param("id") id: string, @Body() body: unknown) {
    return this.directory.updateFunder(id, parseInput(FunderBody.partial(), body));
  }

  @Post("funders/:id/verify")
  verifyFunder(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.directory.verifyFunder(id, user.id);
  }

  @Get("opportunities")
  opportunities(@CurrentUser() user: RequestUser) {
    return this.directory.listOpportunities({
      admin: true,
      viewerTimeZone: user.timezone,
      query: { limit: 100 },
      memberOrgIds: [],
    });
  }

  @Post("opportunities")
  createOpportunity(@Body() body: unknown) {
    return this.directory.createOpportunity(parseInput(OpportunityBody, body));
  }

  @Patch("opportunities/:id")
  updateOpportunity(@Param("id") id: string, @Body() body: unknown) {
    return this.directory.updateOpportunity(id, parseInput(OpportunityBody.partial(), body));
  }

  @Post("opportunities/:id/verify")
  verify(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.directory.verifyOpportunity(id, user.id);
  }

  @Post("opportunities/import")
  importCsv(@Query("dryRun") dryRun: string | undefined, @Body() body: unknown) {
    const input = parseInput(ImportOpportunitiesBody, body);
    return this.directory.importCsv(input.csv, dryRun !== "false");
  }

  @Get("verification-queue")
  queue() {
    return this.directory.verificationQueue();
  }

  @Get("digest-issues")
  issues() {
    return this.digest.listIssues();
  }

  @Patch("digest-issues/:id")
  updateIssue(@Param("id") id: string, @Body() body: unknown) {
    return this.digest.updateIssue(id, parseInput(DigestIssueBody, body));
  }

  @Post("digest-issues/:id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.digest.approve(id, user.id);
  }

  @Post("digest-issues/:id/send")
  send(@Param("id") id: string) {
    return this.digest.enqueueSend(id);
  }

  @Get("settings")
  @RequirePlatform("SUPERADMIN")
  async settings() {
    return this.prisma.db.platformSetting.findMany({ orderBy: { key: "asc" } });
  }

  @Patch("settings/:key")
  @RequirePlatform("SUPERADMIN")
  async updateSetting(@Param("key") key: string, @Body() body: unknown) {
    const input = parseInput(PlatformSettingBody, body);
    return this.prisma.db.platformSetting.update({ where: { key }, data: { value: input.value } });
  }

  @Get("users")
  @RequirePlatform("SUPERADMIN")
  async users(@Query() query: unknown) {
    const input = parseInput(UserLookupQuery, query);
    const user = await this.prisma.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}

@Controller("public/digest")
@UseGuards(ThrottlerGuard, CsrfGuard)
export class PublicDigestController {
  constructor(
    private readonly digest: DigestService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("subscribe")
  @HttpCode(200)
  async subscribe(
    @Body() body: Record<string, unknown>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const normalized = {
      email: body.email,
      communities: asList(body.communities),
      focusAreas: asList(body.focusAreas),
    };
    await this.digest.subscribe(parseInput(DigestSubscribeBody, normalized));
    if (req.is("application/x-www-form-urlencoded") || req.is("multipart/form-data")) {
      res.redirect(303, `${this.env.APP_URL}/digest/check-email`);
      return;
    }
    return { ok: true };
  }

  @Get("confirm")
  async confirm(@Query("token") token: string, @Res() res: Response) {
    const ok = token ? await this.digest.confirm(token) : false;
    res.redirect(303, `${this.env.APP_URL}/digest/${ok ? "confirmed" : "check-email"}`);
  }

  @Get("unsubscribe")
  async unsubscribe(@Query("token") token: string, @Res() res: Response) {
    if (token) await this.digest.unsubscribe(token);
    res.redirect(303, `${this.env.APP_URL}/digest/unsubscribed`);
  }

  @Post("unsubscribe")
  @HttpCode(200)
  async unsubscribePost(@Query("token") token: string, @Body() body: Record<string, unknown>) {
    const value = token || (typeof body.token === "string" ? body.token : "");
    await this.digest.unsubscribe(value);
    return { ok: true };
  }
}

@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("twilio")
  @HttpCode(200)
  async twilio(@Body() body: Record<string, string>) {
    const message = (body.Body ?? "").trim().toUpperCase();
    const from = body.From;
    if (from && (message === "STOP" || message === "START")) {
      await this.prisma.db.user.updateMany({
        where: { phone: from },
        data: { smsOptIn: message === "START" },
      });
    }
    return { ok: true };
  }

  @Post("postmark")
  @HttpCode(200)
  async postmark(@Body() body: { Type?: string; Email?: string; Recipient?: string }) {
    const email = (body.Email ?? body.Recipient ?? "").toLowerCase();
    const type = body.Type ?? "";
    if (email && (type === "HardBounce" || type === "SpamComplaint")) {
      await this.prisma.db.digestSubscriber.updateMany({
        where: { email },
        data: { unsubscribedAt: new Date() },
      });
    }
    return { ok: true };
  }
}

@Controller("test")
export class TestMailboxController {
  constructor(
    @Inject(EMAIL) private readonly email: EmailProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get("mailbox")
  mailbox(@Query("email") email: string) {
    if (this.env.NODE_ENV !== "test" || !isMemoryEmail(this.email)) {
      return { messages: [] };
    }
    return {
      messages: this.email.sent.filter((message) => message.to === email),
    };
  }
}

function asList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}
