import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
  ORG_STATUSES,
  OrgsService,
} from "../../../infrastructure/saas/orgs.service";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  status: z.enum(ORG_STATUSES).optional(),
  q: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  include_platform: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

const patchSchema = z.object({
  status: z.enum(ORG_STATUSES),
});

type ListQuery = z.infer<typeof listQuerySchema>;
type PatchBody = z.infer<typeof patchSchema>;

@ApiTags("saas-organizations")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/organizations")
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: "List tenant organizations (platform)" })
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    return this.orgs.list({
      status: query.status,
      q: query.q,
      limit: query.limit,
      includePlatform: query.include_platform,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get organization by id (platform)" })
  get(@Param("id") id: string) {
    return this.orgs.get(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update organization status (platform)" })
  patch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    return this.orgs.patch(id, { status: body.status });
  }
}
