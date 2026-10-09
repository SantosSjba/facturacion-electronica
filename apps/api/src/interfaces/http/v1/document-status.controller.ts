import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { CdrRecoveryService } from "../../../infrastructure/documents/cdr-recovery.service";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import type { AuthContext } from "../auth/auth-context";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
export const documentStatusQuerySchema = z
  .object({
    company_id: z.uuid(),
    tipo: z.enum(["01", "03", "07", "08", "09", "31", "20", "40", "RC", "RA", "RR"]),
    serie: z.string().regex(/^(?:[FBTVRP][A-Z0-9]{3}|\d{8})$/),
    numero: z.coerce.number().int().positive().max(99999999),
  })
  .strict();
export const documentTicketQuerySchema = z
  .object({ company_id: z.uuid(), ticket: z.string().trim().min(1).max(200) })
  .strict();
@ApiTags("Documentos")
@ApiBearerAuth()
@ApiKeyAuth()
@Controller("v1/document-status")
export class DocumentStatusController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly recovery: CdrRecoveryService,
    private readonly audit: AuditService,
  ) {}
  @Get()
  @RequireScopes("documents:read")
  @ApiQuery({ name: "company_id", type: String, required: true })
  @ApiQuery({ name: "tipo", enum: documentStatusQuerySchema.shape.tipo.options, required: true })
  @ApiQuery({ name: "serie", type: String, required: true })
  @ApiQuery({ name: "numero", type: Number, required: true })
  @ApiOperation({
    summary: "Consultar estado y enlaces CDR por empresa, tipo, serie y número",
    description:
      "Consulta documentos registrados; no emite ni consulta SUNAT automáticamente. Recuperar CDR por UUID o reconciliar ticket cuando corresponda.",
  })
  status(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(documentStatusQuerySchema, 422))
    query: z.infer<typeof documentStatusQuerySchema>,
  ) {
    return this.documents.findByIdentifiers(
      auth.organizationId,
      query.company_id,
      query.tipo,
      query.serie,
      query.numero,
    );
  }
  @Get("ticket")
  @RequireScopes("documents:read")
  @ApiQuery({ name: "company_id", type: String, required: true })
  @ApiQuery({ name: "ticket", type: String, required: true })
  @ApiOperation({ summary: "Consultar estado local y enlaces CDR por ticket registrado" })
  ticket(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(documentTicketQuerySchema, 422))
    query: z.infer<typeof documentTicketQuerySchema>,
  ) {
    return this.documents.findByTicket(auth.organizationId, query.company_id, query.ticket);
  }
  @Post("recover-cdr")
  @HttpCode(200)
  @RequireScopes("documents:write")
  @ApiBody({ schema: z.toJSONSchema(documentStatusQuerySchema) as never })
  @ApiOperation({
    summary: "Recuperar CDR de documento registrado por identificadores",
    description:
      "Factura/notas F en producción; RC/RA mediante ticket existente. Boletas se recuperan por RC. GRE y RR usan sus endpoints reconcile-ticket. No emite ni consume numeración.",
  })
  async recover(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(documentStatusQuerySchema, 422))
    body: z.infer<typeof documentStatusQuerySchema>,
  ) {
    const doc = await this.documents.findByIdentifiers(
      auth.organizationId,
      body.company_id,
      body.tipo,
      body.serie,
      body.numero,
    );
    const result = await this.recovery.recover(auth.organizationId, doc.id);
    await this.audit.append({
      organizationId: auth.organizationId,
      companyId: body.company_id,
      actorType: auth.kind,
      actorId: auth.kind === "api_key" ? auth.apiKeyId : auth.userId,
      action: "document.cdr_recovery_requested",
      resourceType: "document",
      resourceId: doc.id,
    });
    return result;
  }
}
