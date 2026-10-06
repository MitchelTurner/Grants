import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { BILLING, type BillingNotice, type BillingProvider } from "../../common/billing/billing.provider";
import { ENV, type Env } from "../../common/config/env";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(BILLING) private readonly billing: BillingProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async view(orgId: string) {
    const org = await this.requireOrg(orgId);
    return {
      plan: org.plan,
      checkoutReady: Boolean(this.env.STRIPE_PRICE_PRO) || this.billing.mode === "memory",
      portalReady: Boolean(org.stripeCustomerId),
    };
  }

  async checkout(orgId: string, userId: string, slug: string, ip?: string) {
    const org = await this.requireOrg(orgId);
    if (org.plan === "SPONSORED") {
      throw new BadRequestException("This organization already has a sponsored seat.");
    }
    if (org.plan === "PRO") {
      throw new BadRequestException("This organization is already on Pro. Open the billing page to manage it.");
    }
    const priceId = this.env.STRIPE_PRICE_PRO;
    if (!priceId && this.billing.mode === "stripe") {
      throw new BadRequestException("Pro billing is not configured yet.");
    }
    const returnPath = `${this.env.APP_URL}/app/o/${slug}/settings`;
    const session = await this.billing.createCheckout({
      organizationId: orgId,
      customerId: org.stripeCustomerId,
      priceId: priceId ?? "price_unconfigured",
      successUrl: `${returnPath}?billing=return`,
      cancelUrl: returnPath,
    });
    if (session.customerId && session.customerId !== org.stripeCustomerId) {
      await this.prisma.db.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: session.customerId },
      });
    }
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "billing.checkout",
      entityType: "Organization",
      entityId: orgId,
      ip,
    });
    return { url: session.url };
  }

  async portal(orgId: string, slug: string) {
    const org = await this.requireOrg(orgId);
    if (!org.stripeCustomerId) {
      throw new BadRequestException("Start Pro before opening the billing page.");
    }
    const session = await this.billing.createPortal({
      customerId: org.stripeCustomerId,
      returnUrl: `${this.env.APP_URL}/app/o/${slug}/settings`,
    });
    return { url: session.url };
  }

  readNotice(raw: Buffer, signature: string): BillingNotice | null {
    return this.billing.readNotice(raw, signature);
  }

  async apply(notice: BillingNotice): Promise<void> {
    const object = notice.data.object;
    if (
      notice.type === "checkout.session.completed" ||
      notice.type === "checkout.session.async_payment_succeeded"
    ) {
      if (object.payment_status !== "paid" && object.payment_status !== "no_payment_required") {
        return;
      }
      const organizationId = object.metadata?.organizationId ?? object.client_reference_id ?? "";
      if (!organizationId) return;
      const customerId = idOf(object.customer);
      const subscriptionId = idOf(object.subscription);
      await this.prisma.db.organization.updateMany({
        where: { id: organizationId, deletedAt: null, plan: { not: "SPONSORED" } },
        data: {
          plan: "PRO",
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
        },
      });
      return;
    }
    if (notice.type === "customer.subscription.deleted" || notice.type === "customer.subscription.updated") {
      if (notice.type === "customer.subscription.updated" && object.status !== "canceled" && object.status !== "unpaid" && object.status !== "incomplete_expired") {
        return;
      }
      const subscriptionId = object.id;
      if (!subscriptionId) return;
      await this.prisma.db.organization.updateMany({
        where: { stripeSubscriptionId: subscriptionId, plan: "PRO" },
        data: { plan: "FREE", stripeSubscriptionId: null },
      });
    }
  }

  private async requireOrg(orgId: string) {
    const org = await this.prisma.db.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) throw new BadRequestException("That organization was not found.");
    return org;
  }
}

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return null;
}
