import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import {
  DOCUMENT_TYPES,
  SeriesService,
} from "../../../infrastructure/series/series.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  serie: z.string().min(1).max(4),
  next_number: z.number().int().positive().optional(),
  padding: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

const patchSchema = z.object({
  is_active: z.boolean().optional(),
  padding: z.number().int().positive().optional(),
});

const allocateSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  serie: z.string().min(1).max(4),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;
type AllocateBody = z.infer<typeof allocateSchema>;

@ApiTags("series")
@ApiBearerAuth()
@Controller("companies/:companyId/series")
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  @RequirePermissions("series:read")
  @ApiOperation({ summary: "List document series" })
  list(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
  ) {
    this.assertUser(auth);
    return this.series.list(auth.organizationId, companyId);
  }

  @Post()
  @RequirePermissions("series:write")
  @ApiOperation({ summary: "Create document series" })
  create(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
  ) {
    this.assertUser(auth);
    return this.series.create(auth.organizationId, companyId, {
      documentType: body.document_type,
      serie: body.serie,
      nextNumber: body.next_number,
      padding: body.padding,
      isActive: body.is_active,
    });
  }

  @Patch(":seriesId")
  @RequirePermissions("series:write")
  @ApiOperation({ summary: "Update series flags" })
  patch(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @Param("seriesId") seriesId: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    this.assertUser(auth);
    return this.series.patch(auth.organizationId, companyId, seriesId, {
      isActive: body.is_active,
      padding: body.padding,
    });
  }

  @Post("allocate")
  @RequirePermissions("series:write")
  @ApiOperation({
    summary: "Allocate next correlative (FOR UPDATE) — internal/test helper",
  })
  allocate(
    @CurrentAuth() auth: UserAuthContext,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(allocateSchema)) body: AllocateBody,
  ) {
    this.assertUser(auth);
    return this.series.allocateNextNumber({
      organizationId: auth.organizationId,
      companyId,
      documentType: body.document_type,
      serie: body.serie,
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
