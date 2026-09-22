import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  action: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().min(1).optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;

@ApiTags("audit")
@ApiBearerAuth()
@Controller("organizations/me/audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit:read")
  @ApiOperation({ summary: "List organization audit events (redacted)" })
  list(
    @CurrentAuth() auth: UserAuthContext,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    this.assertUser(auth);
    return this.audit.list(auth.organizationId, {
      action: query.action,
      actor: query.actor,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      limit: query.limit,
      cursor: query.cursor,
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
