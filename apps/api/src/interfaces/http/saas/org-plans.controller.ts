import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { OrgPlansService } from "../../../infrastructure/saas/org-plans.service";
import type { AuthContext, UserAuthContext } from "../auth/auth-context";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  organization_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const assignSchema = z.object({
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: z.enum(["trialing", "active"]).optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;
type AssignBody = z.infer<typeof assignSchema>;

@ApiTags("saas-org-plans")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/org-plans")
export class OrgPlansController {
  constructor(
    private readonly orgPlans: OrgPlansService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List org plan assignments (platform)" })
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    return this.orgPlans.list({
      organizationId: query.organization_id,
      limit: query.limit,
    });
  }

  @Post()
  @ApiOperation({ summary: "Assign plan to organization (platform)" })
  async assign(
    @Body(new ZodValidationPipe(assignSchema)) body: AssignBody,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const user = this.assertUser(auth);
    const assigned = await this.orgPlans.assign({
      organizationId: body.organization_id,
      planId: body.plan_id,
      status: body.status,
      reviewedByUserId: user.userId,
    });

    const actor = actorFromAuth(user);
    await this.audit.append({
      organizationId: body.organization_id,
      ...actor,
      action: "plan.assigned",
      resourceType: "org_plan",
      resourceId: assigned.id,
      ...requestMeta(req),
      data: {
        plan_id: assigned.plan_id,
        plan_code: assigned.plan_code,
        status: assigned.status,
        resolved_change_request_ids: assigned.resolved_change_request_ids ?? [],
      },
    });

    return assigned;
  }

  private assertUser(auth: AuthContext): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Platform JWT required");
    }
    return auth;
  }
}
