import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type Redis from "ioredis";
import { organizations, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import { REDIS } from "./redis.tokens";

/** Login attempts per normalized email per fixed 60s window (FE-366 / S17-SEC). */
const LOGIN_RPM_FALLBACK = 10;

/** Public signup attempts per key per fixed 60s window (FE-387 / S17-SEC). */
const SIGNUP_RPM_FALLBACK = 5;

/** Forgot-password attempts per key per fixed 60s window (S17-SEC). */
const FORGOT_RPM_FALLBACK = 3;

@Injectable()
export class RateLimitService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Fixed-window rate limit for console login by normalized email.
   * Throws AppError.rateLimited on exceed.
   */
  async consumeLogin(email: string, limit?: number): Promise<void> {
    const resolved =
      limit ??
      this.config.get("RATE_LIMIT_LOGIN_RPM", { infer: true }) ??
      LOGIN_RPM_FALLBACK;
    const normalized = email.trim().toLowerCase();
    await this.consumeFixedWindow(`rl:login:${normalized}`, resolved, "Login");
  }

  /**
   * Fixed-window rate limit for public signup (email+IP key).
   * Throws AppError.rateLimited on exceed.
   */
  async consumeSignup(key: string, limit?: number): Promise<void> {
    const resolved =
      limit ??
      this.config.get("RATE_LIMIT_SIGNUP_RPM", { infer: true }) ??
      SIGNUP_RPM_FALLBACK;
    const normalized = key.trim().toLowerCase();
    await this.consumeFixedWindow(
      `rl:signup:${normalized}`,
      resolved,
      "Signup",
    );
  }

  /**
   * Fixed-window rate limit for forgot-password (email+IP key).
   * Throws AppError.rateLimited on exceed.
   */
  async consumeForgot(key: string, limit?: number): Promise<void> {
    const resolved =
      limit ??
      this.config.get("RATE_LIMIT_FORGOT_RPM", { infer: true }) ??
      FORGOT_RPM_FALLBACK;
    const normalized = key.trim().toLowerCase();
    await this.consumeFixedWindow(
      `rl:forgot:${normalized}`,
      resolved,
      "Forgot password",
    );
  }

  /**
   * Fixed-window RPM per organization. Throws AppError.rateLimited on exceed.
   */
  async consumeOrg(organizationId: string): Promise<void> {
    const orgRows = await this.db
      .select({ rateLimitRpm: organizations.rateLimitRpm })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const limit =
      orgRows[0]?.rateLimitRpm ??
      this.config.get("RATE_LIMIT_RPM_DEFAULT", { infer: true });

    await this.consumeFixedWindow(
      `rl:org:${organizationId}`,
      limit,
      "Organization",
    );
  }

  private async consumeFixedWindow(
    redisKey: string,
    limit: number,
    label: string,
  ): Promise<void> {
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, 60);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(redisKey);
      const retryAfterSec = Math.max(ttl > 0 ? ttl : 60, 1);
      throw AppError.rateLimited(`${label} rate limit exceeded`, {
        retryAfterSec,
        details: [
          {
            path: "rate_limit",
            issue: `limit=${limit}/min; retry_after_sec=${retryAfterSec}`,
          },
        ],
      });
    }
  }
}
