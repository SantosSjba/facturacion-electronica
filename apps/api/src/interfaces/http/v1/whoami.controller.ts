import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppError } from "@factosys/shared";

import type { ApiKeyAuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";

@ApiTags("Identidad")
@ApiBearerAuth()
@Controller("v1")
export class WhoamiController {
  @Get("whoami")
  @ApiKeyAuth()
  @ApiOperation({ summary: "Identidad de máquina (API key)" })
  whoami(@CurrentAuth() auth: ApiKeyAuthContext) {
    this.assertApiKey(auth);
    return {
      organization_id: auth.organizationId,
      api_key_id: auth.apiKeyId,
      scopes: auth.scopes,
      company_ids: auth.companyIds ?? [],
      environment_constraint: auth.environmentConstraint ?? null,
    };
  }

  @Get("whoami/documents-write")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({
    summary: "Verificación de alcance → 403 sin documents:write",
  })
  whoamiWrite(@CurrentAuth() auth: ApiKeyAuthContext) {
    this.assertApiKey(auth);
    return { ok: true, organization_id: auth.organizationId };
  }

  private assertApiKey(
    auth: ApiKeyAuthContext | { kind: string },
  ): asserts auth is ApiKeyAuthContext {
    if (auth.kind !== "api_key") {
      throw AppError.unauthorized("API key required");
    }
  }
}
