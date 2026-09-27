import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { LegalDocumentsService } from "../../../infrastructure/legal/legal-documents.service";
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
  constructor(private readonly legal: LegalDocumentsService) {}

  @Get("documents")
  @ApiOperation({ summary: "List legal documents (platform; drafts by default filter)" })
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
}
