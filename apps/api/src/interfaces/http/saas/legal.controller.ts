import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { LegalDocumentsService } from "../../../infrastructure/legal/legal-documents.service";
import type { AuthContext, UserAuthContext } from "../auth/auth-context";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { RequirePlatform } from "../decorators/auth.decorators";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createSchema = z.object({
  code: z.string().min(1).max(128),
  version: z.number().int().min(1).optional(),
  title: z.string().min(1).max(512),
  body_md: z.string().min(1),
});

const patchSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  body_md: z.string().min(1).optional(),
  version: z.number().int().min(1).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["draft", "published"]).optional(),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;
type ListQuery = z.infer<typeof listQuerySchema>;

@ApiTags("saas-legal")
@ApiBearerAuth()
@RequirePlatform()
@Controller("saas/legal")
export class LegalController {
  constructor(
    private readonly legal: LegalDocumentsService,
    private readonly audit: AuditService,
  ) {}

  @Get("documents")
  @ApiOperation({
    summary: "List legal documents (platform; drafts by default filter)",
  })
  list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.legal.list({ status: query.status });
  }

  @Get("documents/:id")
  @ApiOperation({ summary: "Get legal document by id (platform)" })
  get(@Param("id") id: string) {
    return this.legal.get(id);
  }

  @Post("documents")
  @ApiOperation({ summary: "Create draft legal document (platform)" })
  create(@Body(new ZodValidationPipe(createSchema)) body: CreateBody) {
    return this.legal.create({
      code: body.code,
      version: body.version,
      title: body.title,
      bodyMd: body.body_md,
    });
  }

  @Patch("documents/:id")
  @ApiOperation({ summary: "Update draft legal document (platform)" })
  patch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    return this.legal.patch(id, {
      title: body.title,
      bodyMd: body.body_md,
      version: body.version,
    });
  }

  @Post("documents/:id/publish")
  @HttpCode(200)
  @ApiOperation({
    summary: "Publish draft legal document (immutable body+hash; S16-LEG)",
  })
  async publish(
    @Param("id") id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const user = this.assertUser(auth);
    const published = await this.legal.publish(id);

    const actor = actorFromAuth(user);
    await this.audit.append({
      organizationId: null,
      ...actor,
      action: "legal.document.published",
      resourceType: "legal_document",
      resourceId: published.id,
      ...requestMeta(req),
      data: {
        code: published.code,
        version: published.version,
        hash: published.hash,
      },
    });

    return published;
  }

  private assertUser(auth: AuthContext): UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Platform JWT required");
    }
    return auth;
  }
}
