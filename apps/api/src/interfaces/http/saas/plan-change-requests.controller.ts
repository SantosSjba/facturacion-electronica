import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { AppError } from "@factosys/shared";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import type { AuthContext } from "../auth/auth-context";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { PlanChangeRequestsService } from "../../../infrastructure/saas/plan-change-requests.service";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const querySchema = z.object({
  status: z.enum(["pending", "acknowledged", "closed"]).optional(),
  organization_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});
const resolveSchema = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(2000).optional() })
  .refine((body) => body.decision !== "reject" || Boolean(body.note), {
    path: ["note"],
    message: "Indica el motivo del rechazo",
  });

@ApiTags("saas-plan-change-requests")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/platform/plan-change-requests")
export class PlanChangeRequestsController {
  constructor(
    private readonly requests: PlanChangeRequestsService,
    private readonly audit: AuditService,
  ) {}

  @Post(":id/resolve")
  @ApiOperation({ summary: "Approve and apply or reject a plan change request (platform)" })
  async resolve(
    @Param("id", new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(resolveSchema)) body: z.infer<typeof resolveSchema>,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    if (auth.kind !== "user") throw AppError.forbidden("Platform JWT required");
    const result = await this.requests.resolve(id, { ...body, actorId: auth.userId });
    await this.audit.append({
      organizationId: result.organization_id,
      ...actorFromAuth(auth),
      ...requestMeta(req),
      action: `plan.change_request.${result.resolution}`,
      resourceType: "plan_change_request",
      resourceId: id,
      data: { resolution: result.resolution, note: body.note ?? null },
    });
    return result;
  }

  @Get()
  @ApiOperation({ summary: "List tenant plan change requests (platform)" })
  list(@Query(new ZodValidationPipe(querySchema)) query: z.infer<typeof querySchema>) {
    return this.requests.list({
      status: query.status,
      organizationId: query.organization_id,
      page: query.page,
      pageSize: query.page_size,
    });
  }
}
