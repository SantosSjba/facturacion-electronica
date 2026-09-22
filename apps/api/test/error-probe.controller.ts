import { Controller, Get, Param } from "@nestjs/common";
import { AppError, AppErrorCode } from "@factosys/shared";

import { Public } from "../src/interfaces/http/decorators/auth.decorators";

/**
 * E2E-only probes for stable AppError → OpenAPI Error mapping (S9-02 / doc 16).
 * Codes are intentional contract surfaces for integrators (`switch` on `code`).
 * Not registered in the production AppModule.
 */
@Controller("__test")
export class ErrorProbeController {
  @Public()
  @Get("app-error")
  boom(): never {
    throw new AppError({
      code: AppErrorCode.VALIDATION,
      message: "Probe validation error",
      httpStatus: 400,
      stage: "request",
      details: [{ path: "field", issue: "invalid" }],
    });
  }

  @Public()
  @Get("errors/:code")
  byCode(@Param("code") code: string): never {
    switch (code) {
      case "FACTOSYS_VALIDATION":
        throw AppError.validation("Probe validation", [
          { path: "field", issue: "invalid" },
        ]);
      case "FACTOSYS_UNAUTHORIZED":
        throw AppError.unauthorized("Probe unauthorized");
      case "FACTOSYS_FORBIDDEN":
        throw AppError.forbidden("Probe forbidden");
      case "FACTOSYS_NOT_FOUND":
        throw AppError.notFound("Probe not found");
      case "FACTOSYS_CONFLICT":
        throw AppError.conflict("Probe conflict");
      case "FACTOSYS_IDEMPOTENCY_CONFLICT":
        throw AppError.idempotencyConflict();
      case "FACTOSYS_RATE_LIMITED":
        throw AppError.rateLimited("Probe rate limited");
      case "FACTOSYS_SUNAT_REJECTED":
        throw new AppError({
          code: AppErrorCode.SUNAT_REJECTED,
          message: "Probe SUNAT rejected",
          httpStatus: 422,
          stage: "sunat_cdr",
          sunatCode: "2324",
          sunatMessage: "Documento rechazado (probe)",
          retryable: false,
        });
      case "FACTOSYS_HTTP":
        throw new AppError({
          code: AppErrorCode.HTTP,
          message: "Probe HTTP error",
          httpStatus: 502,
          stage: "transport",
          retryable: true,
        });
      case "FACTOSYS_INTERNAL":
        throw AppError.internal("Probe internal");
      default:
        throw AppError.validation(`Unknown probe code: ${code}`, [
          { path: "code", issue: code },
        ]);
    }
  }
}
