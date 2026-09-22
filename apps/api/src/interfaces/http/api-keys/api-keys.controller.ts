import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { ApiKeyService } from "../../../infrastructure/api-keys/api-key.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string().min(1)).min(1),
  environment_constraint: z.enum(["sandbox", "production"]).nullable().optional(),
});

type CreateBody = z.infer<typeof createSchema>;

@ApiTags("api-keys")
@ApiBearerAuth()
@Controller("organizations/me/api-keys")
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "List API keys (secrets never returned)" })
  list(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.apiKeys.list(auth.organizationId);
  }

  @Post()
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Create API key — secret returned once" })
  async create(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
    @Req() req: Request,
  ) {
    this.assertUser(auth);
    const created = await this.apiKeys.create({
      organizationId: auth.organizationId,
      name: body.name,
      scopes: body.scopes,
      environmentConstraint: body.environment_constraint ?? null,
    });
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: auth.organizationId,
      ...actor,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: created.id,
      ...requestMeta(req),
      data: {
        name: created.name,
        key_prefix: created.keyPrefix,
        scopes: created.scopes,
        environment_constraint: created.environmentConstraint,
        secret: created.secret,
      },
    });
    return created;
  }

  @Delete(":id")
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Revoke API key" })
  async revoke(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    this.assertUser(auth);
    await this.apiKeys.revoke(auth.organizationId, id);
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: auth.organizationId,
      ...actor,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: id,
      ...requestMeta(req),
      data: {},
    });
    return { ok: true };
  }

  private assertUser(auth: UserAuthContext | { kind: string }): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
