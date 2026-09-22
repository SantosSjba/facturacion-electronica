import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { AuditService } from "../../../infrastructure/audit/audit.service";
import { CpeValidationService } from "../../../infrastructure/validations/cpe-validation.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { actorFromAuth, requestMeta } from "../audit/audit-request.util";

const schema = z.object({
  company_id: z.string().uuid(),
  ruc: z.string().length(11),
  document_type: z.string().min(2).max(2),
  serie: z.string().min(1),
  number: z.union([z.string().min(1), z.number().int().nonnegative()]),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.number(),
});

type BodyDto = z.infer<typeof schema>;

@ApiTags("Validations")
@ApiBearerAuth()
@Controller("v1/validations")
export class ValidationsController {
  constructor(
    private readonly cpe: CpeValidationService,
    private readonly audit: AuditService,
  ) {}

  @Post("cpe")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("validations:cpe")
  @ApiOperation({ summary: "Consult CPE validez (Fake/SUNAT + cache)" })
  async validate(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(schema)) body: BodyDto,
    @Req() req: Request,
  ) {
    const result = await this.cpe.validate(this.orgId(auth), body);
    const actor = actorFromAuth(auth);
    await this.audit.append({
      organizationId: this.orgId(auth),
      companyId: body.company_id,
      ...actor,
      action: "cpe.validated",
      resourceType: "cpe",
      resourceId: `${body.ruc}-${body.document_type}-${body.serie}-${body.number}`,
      ...requestMeta(req),
      data: {
        ruc: body.ruc,
        document_type: body.document_type,
        serie: body.serie,
        number: String(body.number),
        issue_date: body.issue_date,
        total_amount: body.total_amount,
        cpe_status: (result as { cpe_status?: string }).cpe_status,
        cached: (result as { cached?: boolean }).cached,
      },
    });
    return result;
  }

  private orgId(auth: AuthContext): string {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    return auth.organizationId;
  }
}
