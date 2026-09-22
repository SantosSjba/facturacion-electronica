import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import type { Db } from "@factosys/db";

import { DB } from "../../../infrastructure/persistence/db.tokens";

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    @Inject(DB) private readonly db: Db,
  ) {}

  /** Liveness: process is up. */
  @Get("health")
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024)]);
  }

  /**
   * Readiness: Postgres reachable (S3-DB). Redis still deferred to S3-INFRA.
   */
  @Get("ready")
  async ready(): Promise<{ status: "ok"; checks: Record<string, string> }> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        checks: { database: "down", redis: "skipped" },
      });
    }
    return {
      status: "ok",
      checks: {
        database: "up",
        redis: "skipped",
      },
    };
  }
}
