import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { WebhooksService } from "../../../infrastructure/webhooks/webhooks.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).optional(),
  company_id: z.string().uuid().nullable().optional(),
});

const patchSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;

@ApiTags("Webhooks")
@ApiBearerAuth()
@Controller("v1/webhook-endpoints")
export class WebhookEndpointsController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "List webhook endpoints" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.webhooks.list(this.orgId(auth));
  }

  @Post()
  @HttpCode(201)
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "Create webhook endpoint — secret returned once" })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
    @Req() req: Request,
  ) {
    const created = await this.webhooks.create({
      organizationId: this.orgId(auth),
      companyId: body.company_id ?? null,
      url: body.url,
      events: body.events,
    });
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: this.orgId(auth),
      companyId: created.company_id,
      ...actor,
      action: "webhook.created",
      resourceType: "webhook_endpoint",
      resourceId: created.id,
      ...requestMeta(req),
      data: {
        url: created.url,
        events: created.events,
        secret: created.secret,
      },
    });
    return created;
  }

  @Get(":id")
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "Get webhook endpoint" })
  get(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.webhooks.get(this.orgId(auth), id);
  }

  @Patch(":id")
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "Update webhook endpoint (events/status/url)" })
  async patch(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
    @Req() req: Request,
  ) {
    const updated = await this.webhooks.patch(this.orgId(auth), id, {
      url: body.url,
      events: body.events,
      status: body.status,
    });
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: this.orgId(auth),
      companyId: updated.company_id,
      ...actor,
      action: "webhook.updated",
      resourceType: "webhook_endpoint",
      resourceId: updated.id,
      ...requestMeta(req),
      data: {
        url: updated.url,
        events: updated.events,
        status: updated.status,
      },
    });
    return updated;
  }

  @Post(":id/rotate-secret")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "Rotate webhook secret — returned once" })
  async rotate(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    const rotated = await this.webhooks.rotateSecret(this.orgId(auth), id);
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: this.orgId(auth),
      companyId: rotated.company_id,
      ...actor,
      action: "webhook.secret_rotated",
      resourceType: "webhook_endpoint",
      resourceId: rotated.id,
      ...requestMeta(req),
      data: { secret: rotated.secret },
    });
    return rotated;
  }

  @Get(":id/deliveries")
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "List recent deliveries for endpoint" })
  async deliveries(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const rows = await this.webhooks.listDeliveries(this.orgId(auth), id);
    return rows.map((r) => ({
      id: r.id,
      event_type: r.eventType,
      status: r.status,
      attempt_count: r.attemptCount,
      http_status: r.httpStatus,
      last_error: r.lastError,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  private orgId(auth: AuthContext): string {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    return auth.organizationId;
  }
}
