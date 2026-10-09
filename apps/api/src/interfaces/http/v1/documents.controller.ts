import { Controller, Get, Header, Param, Query, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { PdfService } from "../../../infrastructure/pdf/pdf.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  /** Single code (`01`) or CSV (`09,31`). */
  document_type: z
    .string()
    .min(2)
    .refine(
      (v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .every((code) => code.length >= 2 && code.length <= 4),
      { message: "document_type must be 2–4 char codes, optionally comma-separated" },
    )
    .optional(),
  status: z.string().min(1).optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  serie_number: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;

function parseDocumentTypes(raw: string | undefined): {
  documentType?: string;
  documentTypes?: string[];
} {
  if (!raw?.trim()) return {};
  const types = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (types.length === 0) return {};
  if (types.length === 1) return { documentType: types[0] };
  return { documentTypes: types };
}

@ApiTags("Documentos")
@ApiBearerAuth()
@Controller("v1/documents")
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Listar documentos (filtros + cursor)",
    description:
      "Lista documentos de la organización. Filtros: `company_id`, `document_type` (uno o CSV), `status`, fechas, `serie_number`, paginación por `cursor`. Scope `documents:read`.",
  })
  @ApiResponse({ status: 200, description: "Página de documentos." })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    const orgId = this.orgId(auth);
    const typeFilter = parseDocumentTypes(query.document_type);
    const page = await this.documents.list(orgId, {
      companyId: query.company_id,
      allowedCompanyIds: auth.kind === "api_key" ? (auth.companyIds ?? []) : undefined,
      environment: auth.kind === "api_key" ? (auth.environmentConstraint ?? undefined) : undefined,
      ...typeFilter,
      status: query.status,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      serieNumber: query.serie_number,
      limit: query.limit,
      cursor: query.cursor,
    });
    return {
      ...page,
      items: await Promise.all(page.items.map((r) => this.documents.getDetails(orgId, r.id))),
    };
  }

  @Get(":id")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Obtener documento",
    description:
      "Detalle del documento por id (estado SUNAT, serie-número, enlaces). Scope `documents:read`.",
  })
  @ApiResponse({ status: 200, description: "Documento encontrado." })
  @ApiResponse({ status: 404, description: "No existe o no pertenece al tenant." })
  async get(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const orgId = this.orgId(auth);
    return this.documents.getDetails(orgId, id);
  }

  @Get(":id/trace")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Línea de tiempo / eventos del documento",
    description: "Eventos de auditoría del ciclo de vida (emisión, envío, CDR, errores).",
  })
  async trace(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const orgId = this.orgId(auth);
    const events = await this.documents.listEvents(orgId, id);
    return events.map((e) => ({
      at: e.at,
      status: e.status,
      from_status: e.fromStatus,
      detail: e.detail,
      source: e.source,
      data: e.data,
    }));
  }

  @Get(":id/xml")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Descargar XML firmado",
    description: "Descarga el XML firmado cuando está disponible en almacenamiento.",
  })
  @Header("Content-Type", "application/xml")
  async xml(@CurrentAuth() auth: AuthContext, @Param("id") id: string): Promise<StreamableFile> {
    const orgId = this.orgId(auth);
    const art = await this.documents.getArtifact(orgId, id, "xml_signed");
    return new StreamableFile(art.body, {
      type: "application/xml",
      disposition: `attachment; filename="${id}.xml"`,
    });
  }

  @Get(":id/cdr")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Descargar CDR (ZIP)",
    description: "Descarga el CDR de SUNAT (ZIP) cuando el documento fue aceptado/rechazado.",
  })
  async cdr(@CurrentAuth() auth: AuthContext, @Param("id") id: string): Promise<StreamableFile> {
    const orgId = this.orgId(auth);
    const art = await this.documents.getArtifact(orgId, id, "cdr_xml");
    return new StreamableFile(art.body, {
      type: "application/zip",
      disposition: `attachment; filename="${id}-cdr.zip"`,
    });
  }

  @Get(":id/qr")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Datos y PNG del QR CPE basado en XML firmado" })
  qr(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.pdf.getQr(this.orgId(auth), id);
  }

  @Get(":id/qr.png")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Descargar QR CPE en PNG" })
  async qrImage(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const qr = await this.pdf.getQr(this.orgId(auth), id);
    return new StreamableFile(Buffer.from(qr.data_url.split(",")[1] ?? "", "base64"), {
      type: "image/png",
    });
  }

  @Get(":id/pdf")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({
    summary: "Descargar PDF de representación impresa (render diferido)",
    description:
      "Obtiene el PDF RI. Si aún no existe, puede disparar render asíncrono y requerir reintento.",
  })
  async pdfDownload(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    const orgId = this.orgId(auth);
    const art = await this.pdf.getOrRender(orgId, id);
    return new StreamableFile(art.body, {
      type: "application/pdf",
      disposition: `attachment; filename="${id}.pdf"`,
    });
  }

  private orgId(auth: AuthContext): string {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    return auth.organizationId;
  }
}
