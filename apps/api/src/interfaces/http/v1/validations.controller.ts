import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { CpeValidationService } from "../../../infrastructure/validations/cpe-validation.service";
import type { AuthContext } from "../auth/auth-context";
import {
  ApiKeyAuth,
  RequireScopes,
} from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

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
  constructor(private readonly cpe: CpeValidationService) {}

  @Post("cpe")
  @HttpCode(200)
  @ApiKeyAuth()
  @RequireScopes("validations:cpe")
  @ApiOperation({ summary: "Consult CPE validez (Fake/SUNAT + cache)" })
  validate(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(schema)) body: BodyDto,
  ) {
    return this.cpe.validate(this.orgId(auth), body);
  }

  private orgId(auth: AuthContext): string {
    if (auth.kind !== "api_key" && auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    return auth.organizationId;
  }
}
