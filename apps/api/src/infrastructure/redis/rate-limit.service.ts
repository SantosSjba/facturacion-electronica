import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type Redis from "ioredis";
import { organizations, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import { REDIS } from "./redis.tokens";

/** Login attempts per normalized email per fixed 60s window (FE-366). */
const LOGIN_RPM_DEFAULT = 10;

/** Public signup attempts per key per fixed 60s window (FE-387). */
const SIGNUP_RPM_DEFAULT = 5;

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
  async consumeLogin(email: string, limit = LOGIN_RPM_DEFAULT): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const key = `rl:login:${normalized}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      throw AppError.rateLimited("Login rate limit exceeded", {
        details: [
          {
            path: "rate_limit",
            issue: `limit=${limit}/min; retry_after_sec=${Math.max(ttl, 1)}`,
          },
        ],
      });
    }
  }

  /**
   * Fixed-window rate limit for public signup (email+IP key).
   * Throws AppError.rateLimited on exceed.
   */
  async consumeSignup(
    key: string,
    limit = SIGNUP_RPM_DEFAULT,
  ): Promise<void> {
    const normalized = key.trim().toLowerCase();
    const redisKey = `rl:signup:${normalized}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, 60);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(redisKey);
      throw AppError.rateLimited("Signup rate limit exceeded", {
        details: [
          {
            path: "rate_limit",
            issue: `limit=${limit}/min; retry_after_sec=${Math.max(ttl, 1)}`,
          },
        ],
      });
    }
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

    const key = `rl:org:${organizationId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      throw AppError.rateLimited("Organization rate limit exceeded", {
        details: [
          {
            path: "rate_limit",
            issue: `limit=${limit}/min; retry_after_sec=${Math.max(ttl, 1)}`,
          },
        ],
      });
    }
  }
}
