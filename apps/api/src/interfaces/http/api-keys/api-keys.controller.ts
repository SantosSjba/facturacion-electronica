import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import {
  ApiKeyService,
} from "../../../infrastructure/api-keys/api-key.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string().min(1)).min(1),
  environment_constraint: z.enum(["sandbox", "production"]).nullable().optional(),
});

type CreateBody = z.infer<typeof createSchema>;

@ApiTags("api-keys")
@ApiBearerAuth()
@Controller("organizations/me/api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "List API keys (secrets never returned)" })
  list(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.apiKeys.list(auth.organizationId);
  }

  @Post()
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Create API key — secret returned once" })
  create(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
  ) {
    this.assertUser(auth);
    return this.apiKeys.create({
      organizationId: auth.organizationId,
      name: body.name,
      scopes: body.scopes,
      environmentConstraint: body.environment_constraint ?? null,
    });
  }

  @Delete(":id")
  @RequirePermissions("apikeys:manage")
  @ApiOperation({ summary: "Revoke API key" })
  async revoke(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    this.assertUser(auth);
    await this.apiKeys.revoke(auth.organizationId, id);
    return { ok: true };
  }

  private assertUser(auth: UserAuthContext | { kind: string }): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
