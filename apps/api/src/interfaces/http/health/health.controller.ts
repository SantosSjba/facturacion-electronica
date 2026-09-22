import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import type Redis from "ioredis";
import type { Db } from "@factosys/db";

import { DB } from "../../../infrastructure/persistence/db.tokens";
import { REDIS } from "../../../infrastructure/redis/redis.tokens";
import { Public } from "../decorators/auth.decorators";

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: process is up. */
  @Public()
  @Get("health")
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024)]);
  }

  /**
   * Readiness: Postgres + Redis reachable (S3-DB / S3-AUTH).
   */
  @Public()
  @Get("ready")
  async ready(): Promise<{ status: "ok"; checks: Record<string, string> }> {
    let database = "down";
    let redisStatus = "down";
    try {
      await this.db.execute(sql`select 1`);
      database = "up";
    } catch {
      /* keep down */
    }
    try {
      const pong = await this.redis.ping();
      if (pong === "PONG") {
        redisStatus = "up";
      }
    } catch {
      /* keep down */
    }

    if (database !== "up" || redisStatus !== "up") {
      throw new ServiceUnavailableException({
        status: "error",
        checks: { database, redis: redisStatus },
      });
    }

    return {
      status: "ok",
      checks: {
        database: "up",
        redis: "up",
      },
    };
  }
}
