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
  SIGNUP_STATUSES,
  SignupRequestsService,
} from "../../../infrastructure/saas/signup-requests.service";
import type { AuthContext, UserAuthContext } from "../auth/auth-context";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  status: z.enum(SIGNUP_STATUSES).optional(),
  q: z.string().min(1).max(256).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().uuid().optional(),
});

const patchSchema = z
  .object({
    status: z.enum(SIGNUP_STATUSES).optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.notes !== undefined, {
    message: "At least one of status or notes is required",
  });

type ListQuery = z.infer<typeof listQuerySchema>;
type PatchBody = z.infer<typeof patchSchema>;

@ApiTags("saas-signup")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/signup-requests")
export class SignupRequestsController {
  constructor(
    private readonly signup: SignupRequestsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List signup requests (platform; cursor pagination)",
  })
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    return this.signup.list({
      status: query.status,
      q: query.q,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get signup request by id (platform)" })
  get(@Param("id") id: string) {
    return this.signup.get(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update signup request status/notes (platform)",
  })
  async patch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const user = this.assertUser(auth);
    const result = await this.signup.patch(id, {
      status: body.status,
      notes: body.notes,
    });

    if (result.statusChanged || result.notesUpdated) {
      const actor = actorFromAuth(user);
      const action = result.statusChanged
        ? "signup_request.status_changed"
        : "signup_request.updated";
      await this.audit.append({
        organizationId: user.organizationId,
        ...actor,
        action,
        resourceType: "signup_request",
        resourceId: id,
        ...requestMeta(req),
        data: {
          from: result.previousStatus,
          to: result.item.status,
          notes_updated: result.notesUpdated,
        },
      });
    }

    return result.item;
  }

  private assertUser(auth: AuthContext): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Platform JWT required");
    }
    return auth;
  }
}
