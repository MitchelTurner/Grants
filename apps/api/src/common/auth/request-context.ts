import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { MemberRole, PlatformRole } from "@se-grants/shared";
import type { Request } from "express";

export type RequestUser = {
  id: string;
  email: string;
  name: string | null;
  platformRole: PlatformRole;
  timezone: string;
  lastActiveOrgId: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  smsOptIn: boolean;
};

export type RequestOrg = {
  organizationId: string;
  membershipId: string;
  role: MemberRole;
  remindersMuted: boolean;
  timezone: string;
  name: string;
  slug: string;
};

export type AppRequest = Request & {
  user?: RequestUser;
  org?: RequestOrg;
  sessionId?: string;
  csrfToken?: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().user;
});

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().org;
});
