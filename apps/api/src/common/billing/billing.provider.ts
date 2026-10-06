import { createHmac, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { safeEqual } from "../crypto";
import type { Env } from "../config/env";
import { ENV } from "../config/env";

export type BillingNotice = {
  type: string;
  data: {
    object: {
      id?: string;
      metadata?: { organizationId?: string };
      client_reference_id?: string | null;
      payment_status?: string;
      customer?: string | { id?: string } | null;
      subscription?: string | { id?: string } | null;
      status?: string;
    };
  };
};

export interface BillingProvider {
  mode: "memory" | "stripe";
  createCheckout(input: {
    organizationId: string;
    customerId: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; customerId: string | null }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  readNotice(raw: Buffer, signature: string): BillingNotice | null;
}

export const BILLING = Symbol("BILLING");

export function signBillingBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function integrationLabel(): string {
  return `se-grants-pro-${randomBytes(4).toString("hex")}`;
}

@Injectable()
export class MemoryBillingProvider implements BillingProvider {
  readonly mode = "memory" as const;

  constructor(@Inject(ENV) private readonly env: Env) {}

  createCheckout(input: {
    organizationId: string;
    customerId: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; customerId: string | null }> {
    void input.priceId;
    void input.cancelUrl;
    return Promise.resolve({
      url: input.successUrl,
      customerId: input.customerId ?? `cus_memory_${input.organizationId}`,
    });
  }

  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    void input.customerId;
    return Promise.resolve({ url: input.returnUrl });
  }

  readNotice(raw: Buffer, signature: string): BillingNotice | null {
    const secret = this.env.STRIPE_WEBHOOK_SECRET ?? this.env.CSRF_SECRET;
    const expected = signBillingBody(secret, raw.toString("utf8"));
    if (!safeEqual(expected, signature)) return null;
    try {
      const parsed = JSON.parse(raw.toString("utf8")) as BillingNotice;
      if (!parsed?.type || !parsed.data?.object) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

@Injectable()
export class StripeBillingProvider implements BillingProvider {
  readonly mode = "stripe" as const;
  private readonly client: Stripe;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new Stripe(env.STRIPE_SECRET_KEY ?? "");
  }

  async createCheckout(input: {
    organizationId: string;
    customerId: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; customerId: string | null }> {
    let customerId = input.customerId;
    if (!customerId) {
      const customer = await this.client.customers.create({
        metadata: { organizationId: input.organizationId },
      });
      customerId = customer.id;
    }
    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: input.organizationId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { organizationId: input.organizationId },
      subscription_data: { metadata: { organizationId: input.organizationId } },
      integration_identifier: integrationLabel(),
    });
    if (!session.url) {
      throw new Error("Stripe did not return a checkout link.");
    }
    return { url: session.url, customerId };
  }

  async createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  readNotice(raw: Buffer, signature: string): BillingNotice | null {
    if (!this.env.STRIPE_WEBHOOK_SECRET) return null;
    try {
      const event = this.client.webhooks.constructEvent(
        raw,
        signature,
        this.env.STRIPE_WEBHOOK_SECRET,
      );
      return event as unknown as BillingNotice;
    } catch {
      return null;
    }
  }
}
