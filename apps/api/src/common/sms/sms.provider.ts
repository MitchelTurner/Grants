import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Env } from "../config/env";

export type SmsMessage = { to: string; body: string };

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

export const SMS = Symbol("SMS");

export class MemorySmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];

  send(message: SmsMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

export function isMemorySms(provider: SmsProvider): provider is MemorySmsProvider {
  return provider instanceof MemorySmsProvider;
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly env: Env) {}

  async send(message: SmsMessage): Promise<void> {
    const sid = this.env.TWILIO_ACCOUNT_SID ?? "";
    const token = this.env.TWILIO_AUTH_TOKEN ?? "";
    const body = new URLSearchParams({ To: message.to, Body: message.body });
    if (this.env.TWILIO_MESSAGING_SERVICE_SID) {
      body.set("MessagingServiceSid", this.env.TWILIO_MESSAGING_SERVICE_SID);
    } else if (this.env.TWILIO_FROM_NUMBER) {
      body.set("From", this.env.TWILIO_FROM_NUMBER);
    }
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (!response.ok) {
      this.logger.error(`SMS provider rejected a message (${response.status})`);
      const error = new Error("SMS was not accepted");
      if (response.status >= 400 && response.status < 500) {
        error.name = "PermanentSmsError";
      }
      throw error;
    }
  }
}

@Injectable()
export class SmsService {
  constructor(@Inject(SMS) private readonly provider: SmsProvider) {}

  send(message: SmsMessage): Promise<void> {
    return this.provider.send(message);
  }
}
