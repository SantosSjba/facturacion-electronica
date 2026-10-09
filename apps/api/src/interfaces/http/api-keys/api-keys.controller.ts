import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
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

const companyAccessSchema = z
  .object({
    access_mode: z.enum(["single", "multi"]).default("single"),
    company_ids: z.array(z.string().uuid()).min(1).max(100),
  })
  .refine(
    (value) =>
      new Set(value.company_ids).size === value.company_ids.length &&
      (value.access_mode === "multi" || value.company_ids.length === 1),
    {
      path: ["company_ids"],
      message:
        "Single-company keys require exactly one company; multiple companies require access_mode=multi",
    },
  );

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    scopes: z.array(z.string().min(1)).min(1),
    environment_constraint: z.enum(["sandbox", "production"]).nullable().optional(),
  })
  .and(companyAccessSchema);

type CreateBody = z.infer<typeof createSchema>;

const companyAccessProperties = {
  company_ids: {
    type: "array" as const,
    minItems: 1,
    maxItems: 100,
    uniqueItems: true,
    items: { type: "string" as const, format: "uuid" },
    description: "Authorized emitters belonging to this organization",
  },
  access_mode: {
    type: "string" as const,
    enum: ["single", "multi"],
    default: "single",
    description: "single requires exactly one company; multiple companies require explicit multi",
  },
};

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

  @Get("companies")
  @RequirePermissions("apikeys:manage")
  availableCompanies(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.apiKeys.availableCompanies(auth.organizationId);
  }

  @Patch(":id/companies")
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Assign API key companies without rotating its secret" })
  @ApiBody({
    schema: { type: "object", required: ["company_ids"], properties: companyAccessProperties },
  })
  async assignCompanies(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(companyAccessSchema)) body: z.infer<typeof companyAccessSchema>,
    @Req() req: Request,
  ) {
    this.assertUser(auth);
    const result = await this.apiKeys.assignCompanies(auth.organizationId, id, body.company_ids);
    await this.audit.append({
      organizationId: auth.organizationId,
      ...actorFromAuth(auth),
      action: "api_key.companies_updated",
      resourceType: "api_key",
      resourceId: id,
      ...requestMeta(req),
      data: { company_ids: body.company_ids },
    });
    return result;
  }

  @Post()
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Create API key — secret returned once" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "scopes", "company_ids"],
      properties: {
        ...companyAccessProperties,
        name: { type: "string", minLength: 1, maxLength: 120 },
        scopes: { type: "array", minItems: 1, items: { type: "string" } },
        environment_constraint: { type: "string", enum: ["sandbox", "production"], nullable: true },
      },
    },
  })
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
      companyIds: body.company_ids,
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
        company_ids: created.companyIds,
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
