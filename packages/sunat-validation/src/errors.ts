import { AppError, AppErrorCode } from "@factosys/shared";

/** Typed validation-stage errors (no secrets in `message`). */
export function validationError(
  message: string,
  extras?: { cause?: unknown; details?: { path?: string; issue: string }[] },
): AppError {
  return new AppError({
    code: AppErrorCode.VALIDATION,
    message,
    httpStatus: 400,
    stage: "prevalidation",
    retryable: false,
    cause: extras?.cause,
    details: extras?.details,
  });
}

export function validationInternal(
  message: string,
  extras?: { cause?: unknown },
): AppError {
  return new AppError({
    code: AppErrorCode.INTERNAL,
    message,
    httpStatus: 500,
    stage: "prevalidation",
    retryable: true,
    cause: extras?.cause,
  });
}
