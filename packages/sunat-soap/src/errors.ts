import { AppError, AppErrorCode } from "@factosys/shared";

/** Transport-stage errors (SOAP/HTTP). Never include SOL password in message. */
export function soapTransportError(
  message: string,
  extras?: { cause?: unknown; details?: { path?: string; issue: string }[] },
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

export function soapTransportInternal(
  message: string,
  extras?: { cause?: unknown },
): AppError {
  return new AppError({
    code: AppErrorCode.INTERNAL,
    message,
    httpStatus: 500,
    stage: "transport",
    retryable: true,
    cause: extras?.cause,
  });
}

/** CDR-stage rejection from ApplicationResponse. */
export function soapCdrRejected(
  message: string,
  extras?: {
    sunatCode?: string;
    sunatMessage?: string;
    cause?: unknown;
  },
): AppError {
  return new AppError({
    code: AppErrorCode.SUNAT_REJECTED,
    message,
    httpStatus: 422,
    stage: "sunat_cdr",
    retryable: false,
    sunatCode: extras?.sunatCode,
    sunatMessage: extras?.sunatMessage,
    cause: extras?.cause,
  });
}

export function soapCdrInternal(
  message: string,
  extras?: { cause?: unknown },
): AppError {
  return new AppError({
    code: AppErrorCode.INTERNAL,
    message,
    httpStatus: 500,
    stage: "sunat_cdr",
    retryable: true,
    cause: extras?.cause,
  });
}
