import { Body, Controller, Headers, Param, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { Response } from "express";
import { retentionInputSchema, perceptionInputSchema } from "@factosys/sunat-ubl";
import { AppError } from "@factosys/shared";
import { TaxAgentService } from "../../../infrastructure/documents/tax-agent.service";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const retentionCreateSchema = retentionInputSchema.extend({ company_id: z.uuid() });
export const perceptionCreateSchema = perceptionInputSchema.extend({ company_id: z.uuid() });
export const reversionCreateSchema = z
  .object({
    company_id: z.uuid(),
    document_type: z.enum(["20", "40"]),
    issue_date: z.iso.date(),
    reference_date: z.iso.date(),
    communicated_on: z.iso.date(),
    documents: z
      .array(
        z.object({ document_id: z.uuid(), reason: z.string().trim().min(1).max(100) }).strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
// Generated from the same strict runtime contracts. No parallel DTO definition to drift.
const openApi = (
  schema:
    typeof retentionCreateSchema | typeof perceptionCreateSchema | typeof reversionCreateSchema,
) => z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }) as never;

@ApiTags("Retenciones, percepciones y reversiones")
@ApiBearerAuth()
@Controller("v1")
export class TaxAgentsController {
  constructor(
    private readonly agents: TaxAgentService,
    private readonly idempotency: IdempotencyService,
  ) {}
  @Post("retentions")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({ schema: openApi(retentionCreateSchema) })
  @ApiOperation({
    summary: "Emitir comprobante de retención electrónica (20)",
    description:
      "Requiere empresa habilitada como agente. Pagos brutos sin retención; el motor calcula 3% y neto pagado. Resultado asíncrono en /v1/documents/{id}.",
  })
  retention(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(retentionCreateSchema, 422))
    body: z.infer<typeof retentionCreateSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.create(auth, key, body, res, "retentions", (validatedKey) =>
      this.agents.emit(auth.organizationId, "20", body, validatedKey),
    );
  }
  @Post("perceptions")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({ schema: openApi(perceptionCreateSchema) })
  @ApiOperation({
    summary: "Emitir comprobante de percepción electrónica (40)",
    description:
      "Regímenes 01=2%, 02=1%, 03=0.5%. Importe base del cobro sin percepción. Consulta, XML, CDR, PDF y QR en /v1/documents/{id}.",
  })
  perception(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(perceptionCreateSchema, 422))
    body: z.infer<typeof perceptionCreateSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.create(auth, key, body, res, "perceptions", (validatedKey) =>
      this.agents.emit(auth.organizationId, "40", body, validatedKey),
    );
  }
  @Post("reversions")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({ schema: openApi(reversionCreateSchema) })
  @ApiOperation({
    summary: "Enviar resumen de reversión (RR) de 20/40",
    description:
      "Documentos aceptados del mismo tipo, emisor, ambiente y fecha de referencia. Indicar communicated_on de la comunicación electrónica al receptor (máximo siete días). Incluye las reversiones previas aceptadas del mismo día y tipo; conserva originales y numeración.",
  })
  reversion(
    @CurrentAuth() auth: AuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(reversionCreateSchema, 422))
    body: z.infer<typeof reversionCreateSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.create(auth, key, body, res, "reversions", (validatedKey) =>
      this.agents.revert(auth.organizationId, body, validatedKey),
    );
  }
  @Post("reversions/:id/reconcile-ticket")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({ summary: "Reconciliar el ticket existente de un RR sin reenviar" })
  reconcile(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.agents.reconcile(auth.organizationId, id);
  }
  private async create(
    auth: AuthContext,
    key: string | undefined,
    body: { company_id: string },
    res: Response,
    path: string,
    emit: (key: string) => Promise<{ id: string }>,
  ) {
    if (auth.kind !== "api_key" && auth.kind !== "user") throw AppError.unauthorized();
    if (!key)
      throw AppError.validation(
        "Idempotency-Key required",
        [{ path: "Idempotency-Key", issue: "missing" }],
        { httpStatus: 422 },
      );
    await this.agents.assertCompanyScope(auth.organizationId, body.company_id);
    const scope = { organizationId: auth.organizationId, companyId: body.company_id, key };
    const begin = await this.idempotency.begin({ ...scope, requestPath: `POST /v1/${path}`, body });
    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }
    try {
      const doc = await emit(key);
      await this.idempotency.complete({
        ...scope,
        responseCode: 201,
        responseBody: doc,
        documentId: doc.id,
      });
      res.status(201);
      return doc;
    } catch (e) {
      await this.idempotency.release(scope);
      throw e;
    }
  }
}
