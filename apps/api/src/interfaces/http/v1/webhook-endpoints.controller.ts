import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { WebhooksService } from "../../../infrastructure/webhooks/webhooks.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

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
  constructor(private readonly webhooks: WebhooksService) {}

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
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
  ) {
    return this.webhooks.create({
      organizationId: this.orgId(auth),
      companyId: body.company_id ?? null,
      url: body.url,
      events: body.events,
    });
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
  patch(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    return this.webhooks.patch(this.orgId(auth), id, {
      url: body.url,
      events: body.events,
      status: body.status,
    });
  }

  @Post(":id/rotate-secret")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("webhooks:manage")
  @ApiOperation({ summary: "Rotate webhook secret — returned once" })
  rotate(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.webhooks.rotateSecret(this.orgId(auth), id);
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
