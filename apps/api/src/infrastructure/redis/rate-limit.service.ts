import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type Redis from "ioredis";
import { organizations, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { DB } from "../persistence/db.tokens";
import { REDIS } from "./redis.tokens";

@Injectable()
export class RateLimitService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

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
