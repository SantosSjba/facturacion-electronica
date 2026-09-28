import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import {
  ORG_STATUSES,
  OrgsService,
} from "../../../infrastructure/saas/orgs.service";
import type { AuthContext, UserAuthContext } from "../auth/auth-context";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";
import { CurrentAuth } from "../decorators/current-auth.decorator";
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
  constructor(
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

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
  async patch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const user = this.assertUser(auth);
    const before = await this.orgs.get(id);
    const updated = await this.orgs.patch(id, { status: body.status });

    if (before.status !== updated.status) {
      const actor = actorFromAuth(user);
      const action =
        updated.status === "suspended"
          ? "organization.suspended"
          : "organization.reactivated";
      await this.audit.append({
        organizationId: updated.id,
        ...actor,
        action,
        resourceType: "organization",
        resourceId: updated.id,
        ...requestMeta(req),
        data: {
          from: before.status,
          to: updated.status,
        },
      });
    }

    return updated;
  }

  private assertUser(auth: AuthContext): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Platform JWT required");
    }
    return auth;
  }
}
