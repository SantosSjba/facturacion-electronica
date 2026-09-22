import { AppError, AppErrorCode } from "@factosys/shared";

/** Typed signing-stage errors (no secrets in `message`). */
export function signError(
  message: string,
  extras?: { cause?: unknown; details?: { path?: string; issue: string }[] },
): AppError {
  return new AppError({
    code: AppErrorCode.VALIDATION,
    message,
    httpStatus: 400,
    stage: "sign",
    retryable: false,
    cause: extras?.cause,
    details: extras?.details,
  });
}

export function signInternal(
  message: string,
  extras?: { cause?: unknown },
): AppError {
  return new AppError({
    code: AppErrorCode.INTERNAL,
    message,
    httpStatus: 500,
    stage: "sign",
    retryable: true,
    cause: extras?.cause,
  });
}
