import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
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
  pdf_format: z.enum(["A4", "A5", "TICKET80", "TICKET58"]).optional(),
  /** When true (default), creates F001/B001/FC01/FD01/T001/V001. */
  seed_default_series: z.boolean().optional().default(true),
});

const patchSchema = z.object({
  environment: z.enum(["sandbox", "production"]).optional(),
  legal_name: z.string().min(1).optional(),
  trade_name: z.string().nullable().optional(),
  address: z.record(z.string(), z.unknown()).nullable().optional(),
  timezone: z.string().min(1).optional(),
  pdf_format: z.enum(["A4", "A5", "TICKET80", "TICKET58"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
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
      pdfFormat: body.pdf_format,
      seedDefaultSeries: body.seed_default_series,
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
      environment: body.environment,
      legalName: body.legal_name,
      tradeName: body.trade_name,
      address: body.address,
      timezone: body.timezone,
      pdfFormat: body.pdf_format,
      status: body.status,
    });
  }

  private assertUser(auth: UserAuthContext | { kind: string }): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
