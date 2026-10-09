import { Body, Controller, Headers, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AppError } from "@factosys/shared";

import { EmitInvoiceUseCase } from "../../../infrastructure/documents/emit-invoice.use-case";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { invoiceCreateSchema, type InvoiceCreate } from "../dto/invoice-create.schema";
import { CpeInputPipe, withCpeSource } from "../pipes/cpe-input.pipe";

@ApiTags("Facturas")
@ApiBearerAuth()
@Controller("v1")
export class InvoicesController {
  constructor(
    private readonly emitInvoice: EmitInvoiceUseCase,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post("invoices")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Clave única de idempotencia por solicitud de emisión",
  })
  @ApiOperation({
    summary: "Emitir factura electrónica (01)",
    description: [
      "Crea y encola una factura electrónica (tipo 01).",
      "",
      "**Scope:** `documents:write`",
      "**Header obligatorio:** `Idempotency-Key`",
      "",
      "Flujo: validación → UBL → firma → envío SUNAT (o Fake) → estados hasta CDR.",
      "Consulta el resultado con `GET /v1/documents/{id}` o un webhook.",
    ].join("\n"),
  })
  @ApiResponse({
    status: 201,
    description: "Documento creado (puede seguir en proceso SUNAT).",
  })
  @ApiResponse({ status: 401, description: "API key ausente o inválida." })
  @ApiResponse({
    status: 422,
    description: "Validación fallida o falta Idempotency-Key.",
  })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new CpeInputPipe(invoiceCreateSchema, "01")) body: InvoiceCreate,
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
      requestPath: "POST /v1/invoices",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const doc = await this.emitInvoice.execute({
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
      throw withCpeSource(cause, body);
    }
  }
}
