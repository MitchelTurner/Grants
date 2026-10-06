import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  AcceptInvitationBody,
  CreateInvitationBody,
  CreateOrgBody,
  DeleteOrgBody,
  LoginRequestBody,
  PhoneStartBody,
  PhoneVerifyBody,
  NotificationPreferenceBody,
  UpdateMeBody,
  UpdateMemberBody,
  UpdateOrgBody,
  VerifyCodeBody,
} from "@se-grants/shared";
import type { Response } from "express";
import {
  AuthGuard,
  CsrfGuard,
  OrgMemberGuard,
  Public,
  RequireRole,
} from "../../common/auth/guards";
import {
  CurrentOrg,
  CurrentUser,
  type AppRequest,
  type RequestOrg,
  type RequestUser,
} from "../../common/auth/request-context";
import { setSessionCookie } from "../../common/auth/guards";
import { clientIp } from "../../common/auth/guards";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../../common/config/env";
import { clearCookie, readCookie } from "../../common/http/cookies";
import { parseInput } from "../../common/http/parse";
import { AuthService } from "../auth/auth.service";
import { SessionService } from "../../common/auth/session.service";
import { OrgsService } from "../orgs/orgs.service";

@Controller("auth")
@UseGuards(ThrottlerGuard, AuthGuard, CsrfGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get("csrf")
  csrf(@Req() req: AppRequest) {
    return { token: req.csrfToken ?? readCookie(req, "se_csrf") ?? "" };
  }

  @Public()
  @Post("login-request")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AppRequest) {
    const input = parseInput(LoginRequestBody, body);
    await this.auth.requestLogin(input.email, clientIp(req));
    return { ok: true };
  }

  @Public()
  @Post("verify")
  @HttpCode(200)
  async verifyCode(
    @Body() body: unknown,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parseInput(VerifyCodeBody, body);
    const token = await this.auth.verifyCode(input.email, input.code, {
      userAgent: req.header("user-agent"),
      ip: clientIp(req),
    });
    setSessionCookie(res, token, this.env);
    return { ok: true };
  }

  @Public()
  @Get("verify")
  async verifyLink(@Query("token") token: string, @Req() req: AppRequest, @Res() res: Response) {
    const session = token
      ? await this.auth.verifyLink(token, {
          userAgent: req.header("user-agent"),
          ip: clientIp(req),
        })
      : null;
    if (!session) {
      res.redirect(302, `${this.env.APP_URL}/app/sign-in?error=expired`);
      return;
    }
    setSessionCookie(res, session, this.env);
    res.redirect(302, `${this.env.APP_URL}/app`);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.sessions.delete(req.sessionId);
    clearCookie(res, "se_session", this.env.APP_URL.startsWith("https://"));
    return { ok: true };
  }

  @Post("logout-all")
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    await this.sessions.deleteAll(user.id);
    clearCookie(res, "se_session", this.env.APP_URL.startsWith("https://"));
    return { ok: true };
  }
}

@Controller("me")
@UseGuards(AuthGuard, CsrfGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user);
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.auth.updateMe(user, parseInput(UpdateMeBody, body));
  }

  @Post("phone")
  @HttpCode(200)
  async phone(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input = parseInput(PhoneStartBody, body);
    await this.auth.sendPhoneCode(user, input.phone);
    return { ok: true };
  }

  @Post("phone/verify")
  @HttpCode(200)
  async phoneVerify(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input = parseInput(PhoneVerifyBody, body);
    await this.auth.verifyPhone(user, input.code);
    return { ok: true };
  }

  @Get("notifications")
  notifications(@CurrentUser() user: RequestUser) {
    return this.auth.notifications(user.id);
  }

  @Patch("notifications")
  updateNotifications(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.auth.updateNotifications(user.id, parseInput(NotificationPreferenceBody, body));
  }

  @Post("calendar-token/rotate")
  @HttpCode(200)
  rotate(@CurrentUser() user: RequestUser) {
    return this.auth.rotateCalendar(user.id);
  }
}

@Controller("orgs")
@UseGuards(AuthGuard, CsrfGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.orgs.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.orgs.create(user, parseInput(CreateOrgBody, body));
  }

  @Get(":orgId")
  @UseGuards(OrgMemberGuard)
  get(@CurrentOrg() org: RequestOrg) {
    return this.orgs.get(org.organizationId);
  }

  @Patch(":orgId")
  @UseGuards(OrgMemberGuard)
  @RequireRole("EDITOR")
  update(@CurrentOrg() org: RequestOrg, @Body() body: unknown) {
    return this.orgs.update(org.organizationId, parseInput(UpdateOrgBody, body));
  }

  @Delete(":orgId")
  @UseGuards(OrgMemberGuard)
  @RequireRole("OWNER")
  @HttpCode(200)
  async remove(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Req() req: AppRequest,
  ) {
    const input = parseInput(DeleteOrgBody, body);
    await this.orgs.softDelete(org.organizationId, user.id, input.confirmName, clientIp(req));
    return { ok: true };
  }
}

@Controller("orgs/:orgId")
@UseGuards(AuthGuard, CsrfGuard, OrgMemberGuard)
export class MembersController {
  constructor(private readonly orgs: OrgsService) {}

  @Get("members")
  members(@CurrentOrg() org: RequestOrg) {
    return this.orgs.members(org.organizationId);
  }

  @Patch("members/:membershipId")
  updateMember(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
    @Req() req: AppRequest,
  ) {
    return this.orgs.updateMember(
      org.organizationId,
      membershipId,
      user,
      org.role,
      parseInput(UpdateMemberBody, body),
      clientIp(req),
    );
  }

  @Delete("members/:membershipId")
  @HttpCode(200)
  async removeMember(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Param("membershipId") membershipId: string,
    @Req() req: AppRequest,
  ) {
    await this.orgs.removeMember(org.organizationId, membershipId, user, org.role, clientIp(req));
    return { ok: true };
  }

  @Get("invitations")
  @RequireRole("ADMIN")
  invitations(@CurrentOrg() org: RequestOrg) {
    return this.orgs.invitations(org.organizationId);
  }

  @Post("invitations")
  @RequireRole("ADMIN")
  @UseGuards(ThrottlerGuard)
  invite(
    @CurrentOrg() org: RequestOrg,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Req() req: AppRequest,
  ) {
    const input = parseInput(CreateInvitationBody, body);
    return this.orgs.invite(org.organizationId, input.email, input.role, user, clientIp(req));
  }

  @Delete("invitations/:id")
  @RequireRole("ADMIN")
  @HttpCode(200)
  async revoke(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    await this.orgs.revoke(org.organizationId, id);
    return { ok: true };
  }

  @Post("invitations/:id/resend")
  @RequireRole("ADMIN")
  resend(@CurrentOrg() org: RequestOrg, @Param("id") id: string) {
    return this.orgs.resend(org.organizationId, id);
  }
}

@Controller("invitations")
@UseGuards(AuthGuard, CsrfGuard)
export class InvitationAcceptController {
  constructor(private readonly orgs: OrgsService) {}

  @Post("accept")
  @HttpCode(200)
  accept(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input = parseInput(AcceptInvitationBody, body);
    return this.orgs.accept(user, input.token);
  }
}
