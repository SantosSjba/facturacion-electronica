import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { PlansService } from "../../../infrastructure/saas/plans.service";
import { Public, RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const maxField = z.coerce.number().int().min(0);

const createSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  description: z.string().max(4000).nullable().optional(),
  price_monthly_cents: z.coerce.number().int().min(0),
  price_display: z.string().min(1).max(64),
  currency: z.string().length(3),
  max_companies: maxField,
  max_users: maxField,
  max_documents_per_month: maxField,
  max_api_keys: maxField,
  active: z.boolean().optional(),
});

const patchSchema = z.object({
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(4000).nullable().optional(),
  price_monthly_cents: z.coerce.number().int().min(0).optional(),
  price_display: z.string().min(1).max(64).optional(),
  currency: z.string().length(3).optional(),
  max_companies: maxField.optional(),
  max_users: maxField.optional(),
  max_documents_per_month: maxField.optional(),
  max_api_keys: maxField.optional(),
  active: z.boolean().optional(),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;

@ApiTags("saas-plans")
@Controller("saas/plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List active SaaS plans (public catalog)" })
  list() {
    return this.plans.listActive();
  }

  @Public()
  @Get(":id")
  @ApiOperation({ summary: "Get active plan by id (public)" })
  get(@Param("id") id: string) {
    return this.plans.getPublic(id);
  }

  @ApiBearerAuth()
  @RequirePlatform()
  @Post()
  @ApiOperation({ summary: "Create plan (platform)" })
  create(@Body(new ZodValidationPipe(createSchema)) body: CreateBody) {
    return this.plans.create({
      code: body.code,
      name: body.name,
      description: body.description,
      priceMonthlyCents: body.price_monthly_cents,
      priceDisplay: body.price_display,
      currency: body.currency,
      maxCompanies: body.max_companies,
      maxUsers: body.max_users,
      maxDocumentsPerMonth: body.max_documents_per_month,
      maxApiKeys: body.max_api_keys,
      active: body.active,
    });
  }

  @ApiBearerAuth()
  @RequirePlatform()
  @Patch(":id")
  @ApiOperation({ summary: "Update plan (platform)" })
  patch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    return this.plans.patch(id, {
      code: body.code,
      name: body.name,
      description: body.description,
      priceMonthlyCents: body.price_monthly_cents,
      priceDisplay: body.price_display,
      currency: body.currency,
      maxCompanies: body.max_companies,
      maxUsers: body.max_users,
      maxDocumentsPerMonth: body.max_documents_per_month,
      maxApiKeys: body.max_api_keys,
      active: body.active,
    });
  }

  @ApiBearerAuth()
  @RequirePlatform()
  @Delete(":id")
  @ApiOperation({ summary: "Retire plan (soft: active=false; platform)" })
  retire(@Param("id") id: string) {
    return this.plans.retire(id);
  }
}
