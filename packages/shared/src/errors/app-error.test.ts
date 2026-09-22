import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";

describe("AppError", () => {
  it("stores OpenAPI-aligned fields", () => {
    const error = new AppError({
      code: "FACTOSYS_VALIDATION",
      message: "Invalid payload",
      httpStatus: 422,
      retryable: false,
      stage: "request",
      details: [{ path: "ruc", issue: "required" }],
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("FACTOSYS_VALIDATION");
    expect(error.httpStatus).toBe(422);
    expect(error.details?.[0]?.path).toBe("ruc");
  });
});
