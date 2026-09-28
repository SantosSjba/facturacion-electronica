import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { PlansService } from "../../../infrastructure/saas/plans.service";
import { PlatformStatsService } from "../../../infrastructure/saas/platform-stats.service";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const auditListQuerySchema = z.object({
  action: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
  organization_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().min(1).optional(),
});

type AuditListQuery = z.infer<typeof auditListQuerySchema>;

@ApiTags("saas-platform")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/platform")
export class PlatformAdminController {
  constructor(
    private readonly stats: PlatformStatsService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
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

  @Get("audit-events")
  @ApiOperation({
    summary:
      "List audit events across tenants (platform; redacted; S16-AUD)",
  })
  listAuditEvents(
    @Query(new ZodValidationPipe(auditListQuerySchema)) query: AuditListQuery,
  ) {
    return this.audit.listPlatform({
      action: query.action,
      actor: query.actor,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      organizationId: query.organization_id,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
