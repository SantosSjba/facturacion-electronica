import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createSchema = z.object({
  ruc: z.string().regex(/^\d{11}$/),
  legal_name: z.string().min(1),
  trade_name: z.string().nullable().optional(),
  environment: z.enum(["sandbox", "production"]),
  address: z.record(z.string(), z.unknown()).nullable().optional(),
  timezone: z.string().min(1).optional(),
});

const patchSchema = z.object({
  legal_name: z.string().min(1).optional(),
  trade_name: z.string().nullable().optional(),
  address: z.record(z.string(), z.unknown()).nullable().optional(),
  timezone: z.string().min(1).optional(),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;

@ApiTags("companies")
@ApiBearerAuth()
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions("companies:read")
  @ApiOperation({ summary: "List companies for current organization" })
  list(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.companies.list(auth.organizationId);
  }

  @Post()
  @RequirePermissions("companies:write")
  @ApiOperation({ summary: "Create company (sandbox or production)" })
  create(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
  ) {
    this.assertUser(auth);
    return this.companies.create(auth.organizationId, {
      ruc: body.ruc,
      legalName: body.legal_name,
      tradeName: body.trade_name,
      environment: body.environment,
      address: body.address,
      timezone: body.timezone,
    });
  }

  @Get(":id")
  @RequirePermissions("companies:read")
  @ApiOperation({ summary: "Get company (no secrets)" })
  get(@CurrentAuth() auth: UserAuthContext, @Param("id") id: string) {
    this.assertUser(auth);
    return this.companies.get(auth.organizationId, id);
  }

  @Patch(":id")
  @RequirePermissions("companies:write")
  @ApiOperation({ summary: "Update company metadata" })
  patch(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    this.assertUser(auth);
    return this.companies.patch(auth.organizationId, id, {
      legalName: body.legal_name,
      tradeName: body.trade_name,
      address: body.address,
      timezone: body.timezone,
    });
  }

  private assertUser(
    auth: UserAuthContext | { kind: string },
  ): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
