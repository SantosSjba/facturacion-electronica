import {
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppError } from "@factosys/shared";

import { DocumentsService } from "../../../infrastructure/documents/documents.service";
import { PdfService } from "../../../infrastructure/pdf/pdf.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";

@ApiTags("Documents")
@ApiBearerAuth()
@Controller("v1/documents")
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly pdf: PdfService,
  ) {}

  @Get(":id")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Get document" })
  async get(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const orgId = this.orgId(auth);
    const row = await this.documents.getById(orgId, id);
    return this.documents.toPublic(row);
  }

  @Get(":id/trace")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Document timeline / events" })
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
  @ApiOperation({ summary: "Download signed XML" })
  @Header("Content-Type", "application/xml")
  async xml(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
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
  @ApiOperation({ summary: "Download CDR ZIP" })
  async cdr(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    const orgId = this.orgId(auth);
    const art = await this.documents.getArtifact(orgId, id, "cdr_xml");
    return new StreamableFile(art.body, {
      type: "application/zip",
      disposition: `attachment; filename="${id}-cdr.zip"`,
    });
  }

  @Get(":id/pdf")
  @ApiKeyAuth()
  @RequireScopes("documents:read")
  @ApiOperation({ summary: "Download RI PDF (lazy render)" })
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
