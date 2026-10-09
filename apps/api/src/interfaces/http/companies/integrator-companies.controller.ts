import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";
import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import { CredentialsService } from "../../../infrastructure/credentials/credentials.service";
import { SeriesService } from "../../../infrastructure/series/series.service";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import { createSchema as companyCreate, patchSchema as companyPatch } from "./companies.controller";
import { createSchema as seriesCreate, patchSchema as seriesPatch } from "./series.controller";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const integratorCompanyCreateSchema = companyCreate.strict();
export const integratorCompanyPatchSchema = companyPatch.strict();
export const integratorSeriesCreateSchema = seriesCreate.strict();
export const integratorSeriesPatchSchema = seriesPatch.strict();
export const integratorSolSchema = z
  .object({ username: z.string().trim().min(12).max(128), password: z.string().min(1).max(512) })
  .strict();
export const integratorGreSchema = z
  .object({
    client_id: z.string().trim().min(1).max(128),
    client_secret: z.string().min(1).max(512),
  })
  .strict();
const uuid = new ZodValidationPipe(z.string().uuid(), 422);
@ApiTags("Onboarding de integradores")
@ApiBearerAuth()
@ApiKeyAuth()
@Controller("v1/companies")
export class IntegratorCompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly series: SeriesService,
    private readonly credentials: CredentialsService,
    private readonly audit: AuditService,
  ) {}
  @Get()
  @RequireScopes("companies:read")
  @ApiOperation({ summary: "Listar empresas propias sin secretos" })
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.companies.list(auth.organizationId);
    return auth.kind === "api_key" && auth.environmentConstraint
      ? rows.filter((r) => r.environment === auth.environmentConstraint)
      : rows;
  }
  @Get(":id")
  @RequireScopes("companies:read")
  @ApiOperation({ summary: "Consultar configuración y estado de credenciales" })
  get(@CurrentAuth() auth: AuthContext, @Param("id", uuid) id: string) {
    return this.companies.get(auth.organizationId, id);
  }
  @Post()
  @RequireScopes("companies:write")
  @ApiOperation({
    summary: "Crear empresa e inicializar series",
    description:
      "RUC inmutable por empresa. Varias empresas por organización según plan. No elimina historial fiscal.",
  })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(integratorCompanyCreateSchema, 422))
    body: z.infer<typeof integratorCompanyCreateSchema>,
  ) {
    const result = await this.companies.create(auth.organizationId, {
      ruc: body.ruc,
      legalName: body.legal_name,
      tradeName: body.trade_name,
      environment: body.environment,
      address: body.address,
      timezone: body.timezone,
      pdfFormat: body.pdf_format,
      taxAgentSettings: body.tax_agent_settings,
      seedDefaultSeries: body.seed_default_series,
    });
    await this.record(auth, result.id, "company.created");
    return result;
  }
  @Patch(":id")
  @RequireScopes("companies:write")
  @ApiOperation({ summary: "Actualizar configuración o desactivar empresa conservando historial" })
  async patch(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(integratorCompanyPatchSchema, 422))
    body: z.infer<typeof integratorCompanyPatchSchema>,
  ) {
    const result = await this.companies.patch(auth.organizationId, id, {
      environment: body.environment,
      legalName: body.legal_name,
      tradeName: body.trade_name,
      address: body.address,
      timezone: body.timezone,
      pdfFormat: body.pdf_format,
      taxAgentSettings: body.tax_agent_settings,
      status: body.status,
    });
    await this.record(auth, id, "company.updated", { changed_fields: Object.keys(body) });
    return result;
  }
  @Delete(":id")
  @ApiQuery({ name: "permanent", enum: ["true", "false"], required: false })
  @HttpCode(204)
  @RequireScopes("companies:write")
  @ApiOperation({
    summary: "Eliminar empresa lógicamente; permanent=true solo sin historial fiscal ni webhooks",
  })
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Query(
      new ZodValidationPipe(
        z.object({ permanent: z.enum(["true", "false"]).optional() }).strict(),
        422,
      ),
    )
    query: { permanent?: "true" | "false" },
  ) {
    // Permanent deletion records the resource ID without a company foreign key.
    await this.companies.requireCompany(auth.organizationId, id);
    await this.companies.remove(auth.organizationId, id, query.permanent === "true");
    await this.audit.append({
      organizationId: auth.organizationId,
      companyId: query.permanent === "true" ? undefined : id,
      actorType: auth.kind,
      actorId: auth.kind === "api_key" ? auth.apiKeyId : auth.userId,
      action: "company.deleted",
      resourceType: "company",
      resourceId: id,
      data: { permanent: query.permanent === "true" },
    });
  }
  @Get(":id/series")
  @RequireScopes("series:read")
  @ApiOperation({ summary: "Listar series y próximo correlativo" })
  listSeries(@CurrentAuth() auth: AuthContext, @Param("id", uuid) id: string) {
    return this.series.list(auth.organizationId, id);
  }
  @Post(":id/series")
  @RequireScopes("series:write")
  @ApiOperation({ summary: "Crear serie sin consumir correlativos" })
  async addSeries(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(integratorSeriesCreateSchema, 422))
    body: z.infer<typeof integratorSeriesCreateSchema>,
  ) {
    const result = await this.series.create(auth.organizationId, id, {
      documentType: body.document_type,
      serie: body.serie,
      nextNumber: body.next_number,
      padding: body.padding,
      isActive: body.is_active,
    });
    await this.record(auth, id, "company.series_created", { series_id: result.id });
    return result;
  }
  @Patch(":id/series/:seriesId")
  @RequireScopes("series:write")
  @ApiOperation({
    summary: "Activar/desactivar serie o configurar padding; sin reiniciar contador",
  })
  async patchSeries(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Param("seriesId", uuid) seriesId: string,
    @Body(new ZodValidationPipe(integratorSeriesPatchSchema, 422))
    body: z.infer<typeof integratorSeriesPatchSchema>,
  ) {
    const result = await this.series.patch(auth.organizationId, id, seriesId, {
      isActive: body.is_active,
      padding: body.padding,
    });
    await this.record(auth, id, "company.series_updated", { series_id: seriesId });
    return result;
  }
  @Put(":id/sol-credentials")
  @HttpCode(204)
  @RequireScopes("credentials:manage")
  @ApiOperation({
    summary: "Rotar SOL cifrado; nunca devuelve contraseña",
    description: "username = RUC + usuario SOL. Rotación invalida cache OAuth GRE.",
  })
  async sol(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(integratorSolSchema, 422))
    body: z.infer<typeof integratorSolSchema>,
  ) {
    await this.credentials.putSol(auth.organizationId, id, body);
    await this.record(auth, id, "company.sol_rotated");
  }
  @Put(":id/gre-credentials")
  @HttpCode(204)
  @RequireScopes("credentials:manage")
  @ApiOperation({ summary: "Rotar credenciales OAuth GRE cifradas" })
  async gre(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(integratorGreSchema, 422))
    body: z.infer<typeof integratorGreSchema>,
  ) {
    await this.credentials.putGre(auth.organizationId, id, {
      clientId: body.client_id,
      clientSecret: body.client_secret,
    });
    await this.record(auth, id, "company.gre_rotated");
  }
  @Put(":id/certificate")
  @HttpCode(204)
  @RequireScopes("credentials:manage")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "password"],
      properties: { file: { type: "string", format: "binary" }, password: { type: "string" } },
    },
  })
  @ApiOperation({ summary: "Validar y rotar PFX cifrado, máximo 5 MB" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  async certificate(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("password") password: string | undefined,
  ) {
    if (!file?.buffer?.length || !password || password.length > 512)
      throw AppError.validation("PFX file and password required", [], { httpStatus: 422 });
    await this.credentials.putCertificate(auth.organizationId, id, file.buffer, password);
    await this.record(auth, id, "company.certificate_rotated");
  }
  @Delete(":id/credentials/:kind")
  @HttpCode(204)
  @RequireScopes("credentials:manage")
  @ApiOperation({ summary: "Revocar credencial preservando documentos emitidos" })
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param("id", uuid) id: string,
    @Param("kind", new ZodValidationPipe(z.enum(["certificate", "sol", "gre"])))
    kind: "certificate" | "sol" | "gre",
  ) {
    await this.credentials.revoke(auth.organizationId, id, kind);
    await this.record(auth, id, "company.credential_revoked", { kind });
  }
  private record(auth: AuthContext, id: string, action: string, data?: Record<string, unknown>) {
    return this.audit.append({
      organizationId: auth.organizationId,
      companyId: id,
      actorType: auth.kind,
      actorId: auth.kind === "api_key" ? auth.apiKeyId : auth.userId,
      action,
      resourceType: "company",
      resourceId: id,
      data,
    });
  }
}
