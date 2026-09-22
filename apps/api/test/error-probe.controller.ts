import { Controller, Get } from "@nestjs/common";
import { AppError } from "@factosys/shared";

import { Public } from "../src/interfaces/http/decorators/auth.decorators";

/**
 * E2E-only probe to assert AppError → OpenAPI Error mapping.
 * Not registered in the production AppModule.
 */
@Controller("__test")
export class ErrorProbeController {
  @Public()
  @Get("app-error")
  boom(): never {
    throw new AppError({
      code: "FACTOSYS_VALIDATION",
      message: "Probe validation error",
      httpStatus: 400,
      stage: "request",
      details: [{ path: "field", issue: "invalid" }],
    });
  }
}
