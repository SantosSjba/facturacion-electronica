import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Optional,
  Param,
  ParseUUIDPipe,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppError } from "@factosys/shared";
import {
  CompanyLogoService,
  MAX_LOGO_BYTES,
} from "../../../infrastructure/companies/company-logo.service";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";

const logoResponseSchema = {
  type: "object" as const,
  required: ["logo", "data_url"],
  properties: {
    logo: {
      type: "object" as const,
      nullable: true,
      required: ["content_type", "size_bytes", "width", "height", "sha256", "updated_at"],
      properties: {
        content_type: { type: "string" as const, enum: ["image/png"] },
        size_bytes: { type: "integer" as const },
        width: { type: "integer" as const },
        height: { type: "integer" as const },
        sha256: { type: "string" as const },
        updated_at: { type: "string" as const, format: "date-time" },
      },
    },
    data_url: { type: "string" as const, nullable: true, example: "data:image/png;base64,..." },
  },
};

@ApiTags("Empresas")
@ApiBearerAuth()
@ApiKeyAuth()
@ApiResponse({ status: 401, description: "Missing or invalid Bearer credentials" })
@ApiResponse({ status: 403, description: "Missing company scope or permission" })
@ApiResponse({ status: 404, description: "Company not found in the authenticated organization" })
@Controller(["companies/:companyId/logo", "v1/companies/:companyId/logo"])
export class CompanyLogoController {
  constructor(
    private readonly logos: CompanyLogoService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @RequireScopes("companies:read")
  @ApiOkResponse({ schema: logoResponseSchema })
  @ApiOperation({
    summary: "Get company logo metadata and embedded PNG (or null)",
    description:
      "Requires companies:read. Returns {logo, data_url}; data_url can be used directly as an image source.",
  })
  get(@CurrentAuth() auth: AuthContext, @Param("companyId", new ParseUUIDPipe()) id: string) {
    return this.logos.get(auth.organizationId, id);
  }

  @Put()
  @Header("Cache-Control", "private, no-store")
  @RequireScopes("companies:write")
  @ApiOkResponse({ schema: logoResponseSchema })
  @ApiResponse({ status: 400, description: "Missing, unsupported, animated or invalid image" })
  @ApiResponse({ status: 413, description: "File exceeds 2 MB" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({
    summary: "Upload or replace company logo",
    description:
      "Requires companies:write. Static PNG/JPG/WebP, maximum 2 MB and 16 megapixels. Normalized to PNG, maximum 1200×1200. Used automatically when generating invoice, receipt and note PDFs. Existing stored PDFs are preserved.",
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_LOGO_BYTES, files: 1, fields: 0 } }),
  )
  async put(
    @CurrentAuth() auth: AuthContext,
    @Param("companyId", new ParseUUIDPipe()) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length)
      throw AppError.validation("Selecciona un logo", [{ path: "file", issue: "missing" }]);
    const result = await this.logos.put(auth.organizationId, id, file.buffer);
    await this.record(auth, id, "company.logo_updated");
    return result;
  }

  @Delete()
  @HttpCode(204)
  @ApiResponse({ status: 204, description: "Logo removed from the company configuration" })
  @RequireScopes("companies:write")
  @ApiOperation({ summary: "Remove company logo from future PDF generation" })
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("companyId", new ParseUUIDPipe()) id: string,
  ) {
    await this.logos.remove(auth.organizationId, id);
    await this.record(auth, id, "company.logo_removed");
  }
  private record(auth: AuthContext, id: string, action: string) {
    return this.audit?.append({
      organizationId: auth.organizationId,
      companyId: id,
      actorType: auth.kind,
      actorId: auth.kind === "api_key" ? auth.apiKeyId : auth.userId,
      action,
      resourceType: "company",
      resourceId: id,
    });
  }
}
