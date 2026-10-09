import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";
import { CdrRecoveryService } from "../../../infrastructure/documents/cdr-recovery.service";
import { DocumentDeliveryService } from "../../../infrastructure/documents/document-delivery.service";
import { DocumentAccessService } from "../../../infrastructure/documents/document-access.service";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, Public, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const deliveryRequestSchema = z
  .object({ recipients: z.array(z.string().trim().email().max(254)).min(1).max(10) })
  .strict();
export const shareRequestSchema = z
  .object({
    allowed_artifacts: z
      .array(z.enum(["pdf", "xml", "cdr", "qr"]))
      .min(1)
      .max(4),
    ttl_seconds: z.number().int().min(60).max(604800).default(86400),
  })
  .strict();
export const deliveryRetrySchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const uuid = new ZodValidationPipe(z.string().uuid(), 422);

@ApiTags("Integración y entrega")
@ApiBearerAuth()
@Controller("v1/documents")
export class DocumentIntegrationController {
  constructor(
    private readonly recovery: CdrRecoveryService,
    private readonly delivery: DocumentDeliveryService,
    private readonly access: DocumentAccessService,
    private readonly audit: AuditService,
  ) {}
  @Post(":id/recover-cdr")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({
    summary: "Recuperar CDR sin emitir ni reservar correlativo",
    description:
      "Factura/notas F por identificadores en producción; RC/RA por ticket existente. Máximo tres ciclos. GRE usa reconcile-ticket. No equivale a consultar validez.",
  })
  async recover(@CurrentAuth() auth: AuthContext, @Param("id", uuid) id: string) {
    const result = await this.recovery.recover(auth.organizationId, id);
    await this.record(auth, id, "document.cdr_recovery_requested");
    return result;
  }
  @Post(":id/deliveries")
  @ApiKeyAuth()
  @RequireScopes("documents:deliver")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary: "Solicitar entrega por correo a hasta diez destinatarios",
    description:
      "Espera aceptación CPE/RC o aceptación GRE con PDF definitivo. Observados aceptados se entregan; pendientes esperan hasta siete días. Error de correo no altera resultado fiscal.",
  })
  async send(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodValidationPipe(deliveryRequestSchema, 422))
    body: z.infer<typeof deliveryRequestSchema>,
  ) {
    if (!key || key.length > 128 || !/^[\x21-\x7e]+$/.test(key))
      throw AppError.validation("Delivery Idempotency-Key required (1-128 ASCII characters)", [], {
        httpStatus: 422,
      });
    const result = await this.delivery.request(auth.organizationId, id, key, body.recipients);
    await this.record(auth, id, "document.delivery_requested", {
      recipient_count: body.recipients.length,
    });
    return result;
  }
  @Get(":id/deliveries")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Consultar estado propio de entrega por destinatario" })
  list(@CurrentAuth() auth: AuthContext, @Param("id", uuid) id: string) {
    return this.delivery.list(auth.organizationId, id);
  }
  @Post(":id/deliveries/:deliveryId/retry")
  @ApiKeyAuth()
  @RequireScopes("documents:deliver")
  @ApiOperation({
    summary: "Reintento explícito de entrega fallida o incierta",
    description:
      "Requiere motivo. SMTP no garantiza exactamente una entrega; revisar estado unknown antes de autorizar reenvío.",
  })
  async retry(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Param("deliveryId", uuid) delivery: string,
    @Body(new ZodValidationPipe(deliveryRetrySchema, 422))
    body: z.infer<typeof deliveryRetrySchema>,
  ) {
    const result = await this.delivery.retry(auth.organizationId, id, delivery, body.reason);
    await this.record(auth, id, "document.delivery_retry_requested", {
      delivery_id: delivery,
      reason: body.reason,
    });
    return result;
  }
  @Post(":id/shares")
  @ApiKeyAuth()
  @RequireScopes("documents:share")
  @ApiOperation({
    summary: "Crear acceso temporal a archivos de un documento",
    description:
      "Token opaco de 256 bits, almacenado como hash, máximo siete días. URL relativa al host API; token devuelto una vez. Revocable. MinIO permanece privado.",
  })
  async share(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(shareRequestSchema, 422)) body: z.infer<typeof shareRequestSchema>,
  ) {
    const result = await this.access.create(
      auth.organizationId,
      id,
      body.allowed_artifacts,
      body.ttl_seconds,
    );
    await this.record(auth, id, "document.share_created", {
      share_id: result.id,
      allowed_artifacts: body.allowed_artifacts,
      ttl_seconds: body.ttl_seconds,
    });
    return result;
  }
  @Get(":id/shares")
  @ApiKeyAuth()
  @RequireScopes("documents:share")
  @ApiOperation({ summary: "Listar accesos temporales sin revelar tokens" })
  shares(@CurrentAuth() auth: AuthContext, @Param("id", uuid) id: string) {
    return this.access.list(auth.organizationId, id);
  }
  @Delete(":id/shares/:shareId")
  @HttpCode(204)
  @ApiKeyAuth()
  @RequireScopes("documents:share")
  @ApiOperation({ summary: "Revocar acceso compartido" })
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Param("shareId", uuid) share: string,
  ) {
    await this.access.revoke(auth.organizationId, id, share);
    await this.record(auth, id, "document.share_revoked", { share_id: share });
  }
  private record(auth: AuthContext, id: string, action: string, data?: Record<string, unknown>) {
    return this.audit.append({
      organizationId: auth.organizationId,
      actorType: auth.kind,
      actorId: auth.kind === "api_key" ? auth.apiKeyId : auth.userId,
      action,
      resourceType: "document",
      resourceId: id,
      data,
    });
  }
}

@ApiTags("Acceso para destinatarios")
@Controller("v1/shared-documents")
@Public()
export class SharedDocumentsController {
  constructor(private readonly access: DocumentAccessService) {}
  @Get(":token")
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  @ApiOperation({
    summary: "Consultar documento compartido mediante token temporal",
    description:
      "Solo identificador fiscal, estado y archivos permitidos del documento. No expone cliente, organización, listados ni credenciales.",
  })
  get(@Param("token") token: string) {
    return this.access.read(token);
  }
  @Get(":token/:kind")
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "Descargar archivo autorizado del documento compartido" })
  async file(
    @Param("token") token: string,
    @Param("kind", new ZodValidationPipe(z.enum(["pdf", "xml", "cdr", "qr"])))
    kind: "pdf" | "xml" | "cdr" | "qr",
  ) {
    const result = await this.access.read(token, kind);
    if (!("body" in result)) throw AppError.notFound("Artifact not found");
    return new StreamableFile(result.body, {
      type: result.contentType,
      disposition: `attachment; filename="document.${kind === "cdr" ? "zip" : kind === "qr" ? "png" : kind}"`,
    });
  }
}
