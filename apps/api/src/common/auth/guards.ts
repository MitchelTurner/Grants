import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type MemberRole, roleAtLeast } from "@se-grants/shared";
import type { Request, Response } from "express";
import { type Env } from "../config/env";
import { readCookie } from "../http/cookies";
import { PrismaService } from "../prisma/prisma.service";
import type { AppRequest } from "./request-context";
import { SessionService } from "./session.service";

export const ROLE_KEY = "requiredRole";
export const RequireRole = (role: MemberRole) => SetMetadata(ROLE_KEY, role);
export const PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const PLATFORM_KEY = "platformRole";
export const RequirePlatform = (role: "CURATOR" | "SUPERADMIN") => SetMetadata(PLATFORM_KEY, role);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AppRequest>();
    const resolved = await this.sessions.resolve(readCookie(req, "se_session"));
    if (resolved) {
      req.user = resolved.user;
      req.sessionId = resolved.sessionId;
    }
    if (!isPublic && !req.user) {
      throw new UnauthorizedException("Sign in to continue.");
    }
    return true;
  }
}

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const orgId = req.params.orgId;
    if (typeof orgId !== "string" || !req.user) {
      throw new NotFoundException("That organization was not found.");
    }
    const row = await this.prisma.db.membership.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
      include: { organization: true },
    });
    if (!row || row.organization.deletedAt) {
      throw new NotFoundException("That organization was not found.");
    }
    req.org = {
      organizationId: row.organizationId,
      membershipId: row.id,
      role: row.role,
      remindersMuted: row.remindersMuted,
      timezone: row.organization.timezone,
      name: row.organization.name,
      slug: row.organization.slug,
    };
    const required = this.reflector.getAllAndOverride<MemberRole | undefined>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !roleAtLeast(req.org.role, required)) {
      throw new ForbiddenException("You do not have access to do that.");
    }
    return true;
  }
}

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<"CURATOR" | "SUPERADMIN" | undefined>(
      PLATFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const role = req.user?.platformRole;
    if (role === "SUPERADMIN") return true;
    if (required === "CURATOR" && role === "CURATOR") return true;
    throw new ForbiddenException("That page is for curators.");
  }
}

export function clientIp(req: Request): string | undefined {
  return req.ip;
}

export function sessionCookieOptions(env: Env): { secure: boolean } {
  return { secure: env.APP_URL.startsWith("https://") };
}

export function setSessionCookie(res: Response, token: string, env: Env): void {
  res.cookie("se_session", token, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export const CSRF_SKIP = "csrfSkip";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return true;
    }
    const path = req.path;
    if (
      path.startsWith("/api/v1/webhooks") ||
      path.startsWith("/api/v1/public") ||
      path.startsWith("/api/v1/dev-storage")
    ) {
      return true;
    }
    const cookie = readCookie(req, "se_csrf");
    const header = req.header("x-csrf-token");
    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException("Refresh the page and try again.");
    }
    return true;
  }
}
