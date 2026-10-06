import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Env } from "../config/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  stream?: "outbound" | "broadcast";
  headers?: Record<string, string>;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL = Symbol("EMAIL");

export class MemoryEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastTo(email: string): EmailMessage | undefined {
    return [...this.sent].reverse().find((message) => message.to === email);
  }
}

export function isMemoryEmail(provider: EmailProvider): provider is MemoryEmailProvider {
  return provider instanceof MemoryEmailProvider;
}

export class PostmarkEmailProvider implements EmailProvider {
  private readonly logger = new Logger(PostmarkEmailProvider.name);

  constructor(private readonly env: Env) {}

  async send(message: EmailMessage): Promise<void> {
    const stream = message.stream === "broadcast" ? this.env.POSTMARK_BROADCAST_STREAM : "outbound";
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.env.POSTMARK_SERVER_TOKEN ?? "",
      },
      body: JSON.stringify({
        From: this.env.EMAIL_FROM,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        MessageStream: stream,
        Headers: Object.entries(message.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
      }),
    });
    if (!response.ok) {
      const permanent = response.status >= 400 && response.status < 500;
      this.logger.error(`Email provider rejected a message (${response.status})`);
      const error = new Error("Email was not accepted");
      if (permanent) {
        error.name = "PermanentEmailError";
      }
      throw error;
    }
  }
}

@Injectable()
export class MailService {
  constructor(@Inject(EMAIL) private readonly provider: EmailProvider) {}

  send(message: EmailMessage): Promise<void> {
    return this.provider.send(message);
  }
}
