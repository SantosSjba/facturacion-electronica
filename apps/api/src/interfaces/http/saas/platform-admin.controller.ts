import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { AuthService } from "../../../infrastructure/auth/auth.service";
import { PlansService } from "../../../infrastructure/saas/plans.service";
import { PlatformStatsService } from "../../../infrastructure/saas/platform-stats.service";
import type { AuthContext, UserAuthContext } from "../auth/auth-context";
import { requestMeta } from "../audit/audit-request.util";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  RequirePermissions,
  RequirePlatform,
} from "../decorators/auth.decorators";
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

const impersonateSchema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().min(3).max(500),
  ttl_minutes: z.number().int().min(1).max(60).optional(),
});

type AuditListQuery = z.infer<typeof auditListQuerySchema>;
type ImpersonateBody = z.infer<typeof impersonateSchema>;

@ApiTags("saas-platform")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/platform")
export class PlatformAdminController {
  constructor(
    private readonly stats: PlatformStatsService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
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

  @Post("impersonate")
  @HttpCode(200)
  @RequirePermissions("platform:admin")
  @ApiOperation({
    summary:
      "Start support impersonation of a tenant org (short-lived access; S17-SEC)",
  })
  async impersonate(
    @Body(new ZodValidationPipe(impersonateSchema)) body: ImpersonateBody,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const user = this.assertUser(auth);
    const result = await this.authService.impersonate({
      actorUserId: user.userId,
      targetOrganizationId: body.organization_id,
      reason: body.reason,
      ttlMinutes: body.ttl_minutes,
    });

    await this.audit.append({
      organizationId: result.organization_id,
      actorType: "support",
      actorId: user.userId,
      action: "support.impersonation.started",
      resourceType: "organization",
      resourceId: result.organization_id,
      ...requestMeta(req),
      data: {
        reason: result.reason,
        expires_in: result.expires_in,
        organization_name: result.organization_name,
      },
    });

    return result;
  }

  private assertUser(auth: AuthContext): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Platform JWT required");
    }
    return auth;
  }
}
