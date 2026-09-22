import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { AppError } from "@factosys/shared";

import { IdempotencyService } from "../src/infrastructure/idempotency/idempotency.service";
import type { UserAuthContext } from "../src/interfaces/http/auth/auth-context";
import { RequirePermissions } from "../src/interfaces/http/decorators/auth.decorators";
import { CurrentAuth } from "../src/interfaces/http/decorators/current-auth.decorator";

/**
 * E2E-only probe for Redis NX + idempotency_keys (S3-INFRA-03).
 * Not registered in production AppModule.
 */
@Controller("__test")
export class IdempotencyProbeController {
  constructor(private readonly idempotency: IdempotencyService) {}

  @Post("idempotency")
  @HttpCode(200)
  @RequirePermissions("companies:read")
  async probe(
    @CurrentAuth() auth: UserAuthContext,
    @Headers("idempotency-key") key: string | undefined,
    @Body()
    body: { company_id?: string; value?: unknown },
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
    if (!key) {
      throw AppError.validation("Idempotency-Key required", [
        { path: "Idempotency-Key", issue: "missing" },
      ]);
    }
    if (!body.company_id) {
      throw AppError.validation("company_id required", [
        { path: "company_id", issue: "missing" },
      ]);
    }

    const begin = await this.idempotency.begin({
      organizationId: auth.organizationId,
      companyId: body.company_id,
      key,
      requestPath: "POST /__test/idempotency",
      body,
    });

    if (begin.kind === "replay") {
      res.status(begin.responseCode);
      return begin.responseBody;
    }

    try {
      const payload = {
        ok: true,
        value: body.value ?? null,
        echo: `processed:${String(body.value ?? "")}`,
      };
      await this.idempotency.complete({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
        responseCode: 200,
        responseBody: payload,
      });
      return payload;
    } catch (cause) {
      await this.idempotency.release({
        organizationId: auth.organizationId,
        companyId: body.company_id,
        key,
      });
      throw cause;
    }
  }
}
