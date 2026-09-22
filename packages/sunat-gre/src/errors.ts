import { AppError, AppErrorCode } from "@factosys/shared";

/** Transport-stage errors (GRE REST/OAuth). Never include secrets in message. */
export function greTransportError(
  message: string,
  extras?: {
    cause?: unknown;
    details?: Array<{ path?: string; issue: string }>;
  },
): AppError {
  return new AppError({
    code: AppErrorCode.HTTP,
    message,
    httpStatus: 502,
    stage: "transport",
    retryable: true,
    cause: extras?.cause,
    details: extras?.details,
  });
}
