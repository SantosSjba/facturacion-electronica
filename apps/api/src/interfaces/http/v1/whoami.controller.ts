import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppError } from "@factosys/shared";

import type { ApiKeyAuthContext } from "../auth/auth-context";
import { ApiKeyAuth, RequireScopes } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";

@ApiTags("v1")
@ApiBearerAuth()
@Controller("v1")
export class WhoamiController {
  @Get("whoami")
  @ApiKeyAuth()
  @ApiOperation({ summary: "Machine identity (API key)" })
  whoami(@CurrentAuth() auth: ApiKeyAuthContext) {
    this.assertApiKey(auth);
    return {
      organization_id: auth.organizationId,
      api_key_id: auth.apiKeyId,
      scopes: auth.scopes,
    };
  }

  @Get("whoami/documents-write")
  @ApiKeyAuth()
  @RequireScopes("documents:write")
  @ApiOperation({ summary: "Smoke scope check → 403 without documents:write" })
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
