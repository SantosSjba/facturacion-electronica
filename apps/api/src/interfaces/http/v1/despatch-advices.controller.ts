import { Body, Controller, Headers, Param, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AppError } from "@factosys/shared";
import { z } from "zod";

import { EmitDespatchAdviceUseCase } from "../../../infrastructure/documents/emit-despatch-advice.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import {
  despatchAdviceCreateSchema,
  type DespatchAdviceCreate,
} from "../dto/despatch-advice-create.schema";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("Guías de remisión")
@ApiBearerAuth()
@Controller("v1")
export class DespatchAdvicesController {
  constructor(
    private readonly emitDespatch: EmitDespatchAdviceUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("despatch-advices/:id/reconcile-ticket")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({
    summary: "Retomar consulta GRE con ticket existente, sin reenviar",
    description:
      "Máximo tres reconciliaciones manuales, ocho consultas por ciclo. El ticket debe corresponder a la guía; se verifica identidad del CDR antes de aceptar. Si se perdió el ticket, consultar SUNAT; esta operación no recupera tickets por serie/número.",
  })
  async reconcile(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(z.object({ ticket: z.string().uuid() }).strict(), 422))
    body: { ticket: string },
  ) {
    return this.emitDespatch.reconcileTicket(auth.organizationId, id, body.ticket);
  }

  @Post("despatch-advices")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Clave única de idempotencia por solicitud de emisión",
  })
  @ApiOperation({
    summary: "Emitir GRE 09/31 (OAuth + sendDespatch + poll)",
    description:
      "Emite una guía de remisión electrónica. Scope `documents:write`. Requiere `Idempotency-Key`. Flujo GRE: OAuth SUNAT → sendDespatch → poll.",
  })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(despatchAdviceCreateSchema, 422))
    body: DespatchAdviceCreate,
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

    await this.emitDespatch.requireCompanyAccess(auth.organizationId, body.company_id);
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
