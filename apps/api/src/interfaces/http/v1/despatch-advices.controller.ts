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

import { EmitDespatchAdviceUseCase } from "../../../infrastructure/documents/emit-despatch-advice.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  despatchAdviceCreateSchema,
  type DespatchAdviceCreate,
} from "../dto/despatch-advice-create.schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("DespatchAdvices")
@ApiBearerAuth()
@Controller("v1")
export class DespatchAdvicesController {
  constructor(
    private readonly emitDespatch: EmitDespatchAdviceUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("despatch-advices")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary: "Emitir GRE 09/31 (OAuth + sendDespatch + poll)",
  })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(despatchAdviceCreateSchema, 422))
    body: DespatchAdviceCreate,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (auth.kind !== "api_key") {
      throw AppError.forbidden("API key required");
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
      requestPath: "POST /v1/despatch-advices",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitDespatch.execute({
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
