import { Body, Controller, Header, HttpCode, Post, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppError } from "@factosys/shared";
import { PreviewService } from "../../../infrastructure/pdf/preview.service";
import { previewCreateSchema, type PreviewCreate } from "../dto/preview-create.schema";
import type { AuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@ApiTags("Vistas previas")
@ApiBearerAuth()
@Controller("v1/previews")
export class PreviewsController {
  constructor(private readonly previews: PreviewService) {}

  @Post("validate")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({
    summary: "Prevalidar 01/03/07/08/09/31/20/40/RC/RA/RR sin firma ni reserva de numeración",
  })
  validate(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(previewCreateSchema, 422)) body: PreviewCreate,
  ) {
    return this.previews.validate(this.orgId(auth), body);
  }

  @Post("xml")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @Header("X-Factosys-Preview", "true")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "XML sin firmar de vista previa; número 1 referencial, sin reservar" })
  async xml(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(previewCreateSchema, 422)) body: PreviewCreate,
  ) {
    return new StreamableFile(Buffer.from(await this.previews.xml(this.orgId(auth), body)), {
      type: "application/xml",
      disposition: 'attachment; filename="preview-unsigned.xml"',
    });
  }

  @Post("pdf")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @Header("X-Factosys-Preview", "true")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "PDF con marca VISTA PREVIA; hasta 500 líneas y 200 KB" })
  async pdf(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(previewCreateSchema, 422)) body: PreviewCreate,
  ) {
    return new StreamableFile(await this.previews.render(this.orgId(auth), body), {
      type: "application/pdf",
      disposition: 'attachment; filename="preview.pdf"',
    });
  }

  private orgId(auth: AuthContext) {
    if (auth.kind !== "user" && auth.kind !== "api_key") throw AppError.unauthorized();
    return auth.organizationId;
  }
}
