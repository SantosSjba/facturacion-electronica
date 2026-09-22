import {
  Body,
  Controller,
  Headers,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AppError } from "@factosys/shared";

import { EmitVoidedDocumentUseCase } from "../../../infrastructure/documents/emit-voided-document.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  voidedDocumentCreateSchema,
  type VoidedDocumentCreate,
} from "../dto/voided-document-create.schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("VoidedDocuments")
@ApiBearerAuth()
@Controller("v1")
export class VoidedDocumentsController {
  constructor(
    private readonly emitVoided: EmitVoidedDocumentUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("voided-documents")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Comunicación de baja RA (SendSummary + poll)" })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(voidedDocumentCreateSchema, 422))
    body: VoidedDocumentCreate,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    if (!key) {
      throw AppError.validation(
        "Idempotency-Key required",
        [{ path: "Idempotency-Key", issue: "missing" }],
        { httpStatus: 422 },
      );
    }

    const begin = await this.idempotency.begin({
      organizationId: auth.organizationId,
      companyId: body.company_id,
      key,
      requestPath: "POST /v1/voided-documents",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitVoided.execute({
        organizationId: auth.organizationId,
        body,
        idempotencyKey: key,
      });
      await this.idempotency.complete({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
        responseCode: 201,
        responseBody: doc,
        documentId: doc.id,
      });
      res.status(201);
      return doc;
    } catch (cause) {
      await this.idempotency.release({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
      });
      throw cause;
    }
  }
}
