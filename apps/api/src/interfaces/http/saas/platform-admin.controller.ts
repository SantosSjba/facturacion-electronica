import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PlansService } from "../../../infrastructure/saas/plans.service";
import { PlatformStatsService } from "../../../infrastructure/saas/platform-stats.service";
import { RequirePlatform } from "../decorators/auth.decorators";

@ApiTags("saas-platform")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/platform")
export class PlatformAdminController {
  constructor(
    private readonly stats: PlatformStatsService,
    private readonly plans: PlansService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Platform admin health (requires platform JWT ctx)" })
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("stats")
  @ApiOperation({ summary: "Platform dashboard KPI counts" })
  getStats() {
    return this.stats.getStats();
  }

  @Get("plans")
  @ApiOperation({ summary: "List all plans including retired (platform)" })
  listPlans() {
    return this.plans.listAll();
  }
}
