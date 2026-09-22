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

import { EmitDailySummaryUseCase } from "../../../infrastructure/documents/emit-daily-summary.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  dailySummaryCreateSchema,
  type DailySummaryCreate,
} from "../dto/daily-summary-create.schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("DailySummaries")
@ApiBearerAuth()
@Controller("v1")
export class DailySummariesController {
  constructor(
    private readonly emitDaily: EmitDailySummaryUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("daily-summaries")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Resumen diario RC (auto-pool + SendSummary + poll)" })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(dailySummaryCreateSchema, 422))
    body: DailySummaryCreate,
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
      requestPath: "POST /v1/daily-summaries",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitDaily.execute({
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
