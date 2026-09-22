import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /** Liveness: process is up. */
  @Get("health")
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024)]);
  }

  /**
   * Readiness stub (S0): no Postgres/Redis yet.
   * Returns 200 JSON so orchestrators can probe the route.
   */
  @Get("ready")
  ready(): { status: "ok"; checks: Record<string, string> } {
    return {
      status: "ok",
      checks: {
        database: "skipped",
        redis: "skipped",
      },
    };
  }
}
