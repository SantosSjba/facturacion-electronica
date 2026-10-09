import { AppError, AppErrorCode } from "@factosys/shared";

/** Transport-stage errors (GRE REST/OAuth). Never include secrets in message. */
export function greTransportError(
  message: string,
  extras?: {
    cause?: unknown;
    sunatCode?: string;
    sunatMessage?: string;
    retryable?: boolean;
    details?: { path?: string; issue: string }[];
  },
): AppError {
  return new AppError({
    code: AppErrorCode.HTTP,
    message,
    httpStatus: 502,
    stage: "transport",
    retryable: extras?.retryable ?? true,
    sunatCode: extras?.sunatCode,
    sunatMessage: extras?.sunatMessage,
    cause: extras?.cause,
    details: extras?.details,
  });
}
