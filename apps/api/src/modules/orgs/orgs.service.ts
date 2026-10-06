import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  complianceTemplatesFor,
  type MemberRole,
  profileCompleteness,
  roleAtLeast,
  slugify,
} from "@se-grants/shared";
import { AuditService } from "../../common/audit/audit.service";
import type { RequestUser } from "../../common/auth/request-context";
import { ENV, type Env } from "../../common/config/env";
import { maskEmail, randomToken, sha256 } from "../../common/crypto";
import { moneyOut } from "../../common/http/values";
import { MailService } from "../../common/mail/email.provider";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { CreateOrgBody, UpdateOrgBody } from "@se-grants/shared";
import type { z } from "zod";

type CreateOrg = z.infer<typeof CreateOrgBody>;
type UpdateOrg = z.infer<typeof UpdateOrgBody>;

const INVITE_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.db.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      type: row.organization.type,
      community: row.organization.community,
      role: row.role,
      remindersMuted: row.remindersMuted,
      plan: row.organization.plan,
    }));
  }

  async create(user: RequestUser, input: CreateOrg) {
    const slug = await this.uniqueSlug(input.name);
    const org = await this.prisma.db.organization.create({
      data: {
        name: input.name,
        slug,
        type: input.type,
        community: input.community,
        servesCommunities: input.servesCommunities ?? [],
        focusAreas: input.focusAreas,
        receivesFederalFunds: input.receivesFederalFunds,
        ein: input.ein,
        uei: input.uei,
        annualBudget: input.annualBudget,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    if (!user.lastActiveOrgId) {
      await this.prisma.db.user.update({
        where: { id: user.id },
        data: { lastActiveOrgId: org.id },
      });
    }
    return {
      ...this.toProfile(org),
      suggestedTemplates: this.suggestions(org),
    };
  }

  async get(orgId: string) {
    const org = await this.requireOrg(orgId);
    return {
      ...this.toProfile(org),
      completeness: profileCompleteness({
        type: org.type,
        community: org.community,
        focusAreas: org.focusAreas,
        mission: org.mission,
        website: org.website,
        ein: org.ein,
        uei: org.uei,
        annualBudget: moneyOut(org.annualBudget),
        receivesFederalFunds: org.receivesFederalFunds,
        fiscalSponsorName: org.fiscalSponsorName,
      }),
    };
  }

  async update(orgId: string, input: UpdateOrg) {
    const current = await this.requireOrg(orgId);
    if (input.timezone) {
      const { isValidTimeZone } = await import("@se-grants/shared");
      if (!isValidTimeZone(input.timezone)) {
        throw new BadRequestException("Choose a time zone from the list.");
      }
    }
    const org = await this.prisma.db.organization.update({
      where: { id: orgId },
      data: {
        name: input.name,
        type: input.type,
        community: input.community,
        servesCommunities: input.servesCommunities,
        ein: input.ein,
        uei: input.uei,
        website: input.website,
        mission: input.mission,
        annualBudget: input.annualBudget,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        focusAreas: input.focusAreas,
        receivesFederalFunds: input.receivesFederalFunds,
        fiscalSponsorName: input.fiscalSponsorName,
        timezone: input.timezone,
      },
    });
    const typeChanged = input.type !== undefined && input.type !== current.type;
    const federalChanged =
      input.receivesFederalFunds !== undefined &&
      input.receivesFederalFunds !== current.receivesFederalFunds;
    return {
      ...this.toProfile(org),
      completeness: profileCompleteness({
        type: org.type,
        community: org.community,
        focusAreas: org.focusAreas,
        mission: org.mission,
        website: org.website,
        ein: org.ein,
        uei: org.uei,
        annualBudget: moneyOut(org.annualBudget),
        receivesFederalFunds: org.receivesFederalFunds,
        fiscalSponsorName: org.fiscalSponsorName,
      }),
      suggestedTemplates: typeChanged || federalChanged ? this.suggestions(org) : [],
    };
  }

  async softDelete(orgId: string, userId: string, confirmName: string, ip?: string) {
    const org = await this.requireOrg(orgId);
    if (org.name !== confirmName) {
      throw new BadRequestException("Type the organization name exactly to confirm.");
    }
    await this.prisma.db.organization.update({
      where: { id: orgId },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "org.delete",
      entityType: "Organization",
      entityId: orgId,
      ip,
    });
  }

  async members(orgId: string) {
    const rows = await this.prisma.db.membership.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
      remindersMuted: row.remindersMuted,
    }));
  }

  async updateMember(
    orgId: string,
    membershipId: string,
    actor: RequestUser,
    actorRole: MemberRole,
    input: { role?: MemberRole; remindersMuted?: boolean },
    ip?: string,
  ) {
    const membership = await this.prisma.db.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });
    if (!membership) {
      throw new NotFoundException("That member was not found.");
    }
    const self = membership.userId === actor.id;
    if (input.role && input.role !== membership.role) {
      if (!roleAtLeast(actorRole, "ADMIN")) {
        throw new ForbiddenException("You do not have access to do that.");
      }
      if (membership.role === "OWNER" && actorRole !== "OWNER") {
        throw new ForbiddenException("Only an owner can change another owner's role.");
      }
      if (membership.role === "OWNER" && input.role !== "OWNER") {
        await this.assertAnotherOwner(orgId, membership.id);
      }
    } else if (input.remindersMuted !== undefined && !self && !roleAtLeast(actorRole, "ADMIN")) {
      throw new ForbiddenException("You do not have access to do that.");
    }
    const updated = await this.prisma.db.membership.update({
      where: { id: membership.id },
      data: { role: input.role, remindersMuted: input.remindersMuted },
    });
    if (input.role && input.role !== membership.role) {
      await this.audit.log({
        organizationId: orgId,
        userId: actor.id,
        action: "membership.role_changed",
        entityType: "Membership",
        entityId: membership.id,
        metadata: { from: membership.role, to: input.role },
        ip,
      });
    }
    return { id: updated.id, role: updated.role, remindersMuted: updated.remindersMuted };
  }

  async removeMember(
    orgId: string,
    membershipId: string,
    actor: RequestUser,
    actorRole: MemberRole,
    ip?: string,
  ) {
    const membership = await this.prisma.db.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });
    if (!membership) throw new NotFoundException("That member was not found.");
    if (!roleAtLeast(actorRole, "ADMIN")) {
      throw new ForbiddenException("You do not have access to do that.");
    }
    if (membership.role === "OWNER") {
      if (actorRole !== "OWNER") {
        throw new ForbiddenException("Only an owner can remove another owner.");
      }
      await this.assertAnotherOwner(orgId, membership.id);
    }
    await this.prisma.db.membership.delete({ where: { id: membership.id } });
    await this.audit.log({
      organizationId: orgId,
      userId: actor.id,
      action: "membership.removed",
      entityType: "Membership",
      entityId: membership.id,
      ip,
    });
  }

  async invite(orgId: string, email: string, role: MemberRole, actor: RequestUser, ip?: string) {
    const token = randomToken();
    const invite = await this.prisma.db.invitation.create({
      data: {
        organizationId: orgId,
        email,
        role,
        tokenHash: sha256(token),
        invitedById: actor.id,
        expiresAt: new Date(Date.now() + INVITE_MS),
      },
    });
    await this.sendInvite(email, token, orgId);
    await this.audit.log({
      organizationId: orgId,
      userId: actor.id,
      action: "invitation.created",
      entityType: "Invitation",
      entityId: invite.id,
      metadata: { email: maskEmail(email), role },
      ip,
    });
    return { id: invite.id, email, role, expiresAt: invite.expiresAt.toISOString() };
  }

  async invitations(orgId: string) {
    const rows = await this.prisma.db.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  async revoke(orgId: string, invitationId: string) {
    const invite = await this.prisma.db.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invite) throw new NotFoundException("That invitation was not found.");
    await this.prisma.db.invitation.delete({ where: { id: invite.id } });
  }

  async resend(orgId: string, invitationId: string) {
    const invite = await this.prisma.db.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId, acceptedAt: null },
    });
    if (!invite) throw new NotFoundException("That invitation was not found.");
    const token = randomToken();
    const updated = await this.prisma.db.invitation.update({
      where: { id: invite.id },
      data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_MS) },
    });
    await this.sendInvite(invite.email, token, orgId);
    return { id: updated.id, expiresAt: updated.expiresAt.toISOString() };
  }

  async accept(user: RequestUser, token: string) {
    const invite = await this.prisma.db.invitation.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException("That invitation has expired.");
    }
    if (invite.email !== user.email) {
      throw new ForbiddenException("Sign in with the email address that was invited.");
    }
    await this.prisma.db.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
      create: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
      update: {},
    });
    await this.prisma.db.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return { organizationId: invite.organizationId };
  }

  private async sendInvite(email: string, token: string, orgId: string) {
    const org = await this.requireOrg(orgId);
    const link = `${this.env.APP_URL}/app/sign-in?invite=${encodeURIComponent(token)}`;
    await this.mail.send({
      to: email,
      subject: `Join ${org.name} on Southeast Grants`,
      text: `${org.name} invited you. Sign in with this email address, then open:\n${link}\nThe invitation expires in 14 days.`,
    });
  }

  private async assertAnotherOwner(orgId: string, exceptId: string) {
    const owners = await this.prisma.db.membership.count({
      where: { organizationId: orgId, role: "OWNER", id: { not: exceptId } },
    });
    if (owners < 1) {
      throw new ConflictException("An organization needs at least one owner.");
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let n = 2;
    while (await this.prisma.db.organization.findUnique({ where: { slug } })) {
      slug = `${base.slice(0, 48)}-${n}`;
      n += 1;
    }
    return slug;
  }

  private async requireOrg(orgId: string) {
    const org = await this.prisma.db.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) throw new NotFoundException("That organization was not found.");
    return org;
  }

  private suggestions(org: {
    type: CreateOrg["type"];
    receivesFederalFunds: boolean;
    fiscalYearStartMonth: number;
  }) {
    const today = new Date().toISOString().slice(0, 10);
    return complianceTemplatesFor({
      orgType: org.type,
      receivesFederalFunds: org.receivesFederalFunds,
      fiscalYearStartMonth: org.fiscalYearStartMonth,
      today,
    });
  }

  private toProfile(org: {
    id: string;
    name: string;
    slug: string;
    type: CreateOrg["type"];
    community: string;
    servesCommunities: string[];
    ein: string | null;
    uei: string | null;
    website: string | null;
    mission: string | null;
    annualBudget: { toString(): string } | null;
    fiscalYearStartMonth: number;
    focusAreas: string[];
    receivesFederalFunds: boolean;
    fiscalSponsorName: string | null;
    timezone: string;
    plan: string;
  }) {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      community: org.community,
      servesCommunities: org.servesCommunities,
      ein: org.ein,
      uei: org.uei,
      website: org.website,
      mission: org.mission,
      annualBudget: moneyOut(org.annualBudget),
      fiscalYearStartMonth: org.fiscalYearStartMonth,
      focusAreas: org.focusAreas,
      receivesFederalFunds: org.receivesFederalFunds,
      fiscalSponsorName: org.fiscalSponsorName,
      timezone: org.timezone,
      plan: org.plan,
    };
  }
}
