import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env.schema";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface SendEmailResult {
  providerMessageId: string | null;
}

export interface LoggedEmail extends SendEmailInput {
  at: string;
  providerMessageId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  /** Sandbox ring buffer for e2e (EMAIL_DRIVER=log). */
  private readonly logSent: LoggedEmail[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Recent sandbox sends (newest last). */
  getLoggedEmails(): readonly LoggedEmail[] {
    return this.logSent;
  }

  clearLoggedEmails(): void {
    this.logSent.length = 0;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const driver = this.config.get("EMAIL_DRIVER", { infer: true });
    const from = this.config.get("EMAIL_FROM", { infer: true });

    if (driver === "log") {
      const providerMessageId = `log-${Date.now()}`;
      this.logger.log(
        `sandbox email to=${input.to} subject=${JSON.stringify(input.subject)}`,
      );
      this.logSent.push({
        ...input,
        at: new Date().toISOString(),
        providerMessageId,
      });
      if (this.logSent.length > 100) {
        this.logSent.splice(0, this.logSent.length - 100);
      }
      return { providerMessageId };
    }

    if (driver === "resend") {
      return this.sendResend(from, input);
    }

    return this.sendSmtp(from, input);
  }

  private async sendResend(
    from: string,
    input: SendEmailInput,
  ): Promise<SendEmailResult> {
    const apiKey = this.config.get("RESEND_API_KEY", { infer: true });
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required when EMAIL_DRIVER=resend");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id?: string };
    return { providerMessageId: json.id ?? null };
  }

  private async sendSmtp(
    from: string,
    input: SendEmailInput,
  ): Promise<SendEmailResult> {
    const host = this.config.get("SMTP_HOST", { infer: true });
    if (!host) {
      throw new Error("SMTP_HOST is required when EMAIL_DRIVER=smtp");
    }
    const port = this.config.get("SMTP_PORT", { infer: true });
    const user = this.config.get("SMTP_USER", { infer: true });
    const pass = this.config.get("SMTP_PASS", { infer: true });

    // Dynamic import keeps nodemailer optional until smtp driver is used.
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return {
      providerMessageId:
        typeof info.messageId === "string" ? info.messageId : null,
    };
  }
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? "";
  });
}
