import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { newId, signupRequests, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import { RateLimitService } from "../redis/rate-limit.service";

export interface SignupRequestPublic {
  id: string;
  company_name: string;
  ruc: string;
  contact_name: string;
  contact_email: string;
  plan_code: string | null;
  status: string;
  created_at: string;
}

@Injectable()
export class SignupRequestsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Captcha hook (FE-388): when CAPTCHA_SECRET is unset, accept any token.
   * When set, require a non-empty captcha_token (provider wiring comes later).
   */
  assertCaptcha(captchaToken?: string): void {
    const secret = this.config.get("CAPTCHA_SECRET", { infer: true });
    if (!secret) {
      return;
    }
    if (!captchaToken?.trim()) {
      throw AppError.validation("captcha_token is required", [
        { path: "captcha_token", issue: "Required when captcha is enabled" },
      ]);
    }
  }

  async createPublic(input: {
    companyName: string;
    ruc: string;
    contactName: string;
    contactEmail: string;
    planCode?: string;
    notes?: string;
    captchaToken?: string;
    rateLimitKey: string;
  }): Promise<SignupRequestPublic> {
    await this.rateLimit.consumeSignup(input.rateLimitKey);
    this.assertCaptcha(input.captchaToken);

    const id = newId();
    const now = new Date();
    await this.db.insert(signupRequests).values({
      id,
      companyName: input.companyName,
      ruc: input.ruc,
      contactName: input.contactName,
      contactEmail: input.contactEmail.trim().toLowerCase(),
      planCode: input.planCode ?? null,
      notes: input.notes ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      company_name: input.companyName,
      ruc: input.ruc,
      contact_name: input.contactName,
      contact_email: input.contactEmail.trim().toLowerCase(),
      plan_code: input.planCode ?? null,
      status: "pending",
      created_at: now.toISOString(),
    };
  }
}
