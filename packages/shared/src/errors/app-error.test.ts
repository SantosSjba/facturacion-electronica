import { describe, expect, it } from "vitest";

import { AppErrorCode } from "./app-error-code";
import { AppError } from "./app-error";

describe("AppErrorCode", () => {
  it("exposes stable FACTOSYS_* stubs", () => {
    expect(AppErrorCode.VALIDATION).toBe("FACTOSYS_VALIDATION");
    expect(AppErrorCode.INTERNAL).toBe("FACTOSYS_INTERNAL");
    expect(AppErrorCode.SUNAT_REJECTED).toBe("FACTOSYS_SUNAT_REJECTED");
  });
});

describe("AppError factories", () => {
  it("validation() uses AppErrorCode.VALIDATION", () => {
    const error = AppError.validation("bad field", [{ path: "ruc", issue: "required" }]);
    expect(error.code).toBe(AppErrorCode.VALIDATION);
    expect(error.httpStatus).toBe(400);
    expect(error.details?.[0]?.path).toBe("ruc");
  });

  it("notFound() and auth helpers set status codes", () => {
    expect(AppError.notFound("missing").httpStatus).toBe(404);
    expect(AppError.unauthorized().httpStatus).toBe(401);
    expect(AppError.forbidden().httpStatus).toBe(403);
    expect(AppError.rateLimited().httpStatus).toBe(429);
    expect(AppError.internal("boom").retryable).toBe(true);
  });
});
