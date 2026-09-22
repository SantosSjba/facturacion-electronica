import { AppErrorCode } from "./app-error-code";

export type ErrorStage =
  "request" | "prevalidation" | "sign" | "transport" | "sunat_cdr" | "webhook";

export interface AppErrorDetail {
  path?: string;
  issue: string;
}

export interface AppErrorParams {
  code: string;
  message: string;
  httpStatus?: number;
  retryable?: boolean;
  stage?: ErrorStage;
  details?: AppErrorDetail[];
  sunatCode?: string;
  sunatMessage?: string;
  rulesetVersion?: string;
  cause?: unknown;
}

/**
 * Domain/application error mapped to OpenAPI `Error` by the HTTP exception filter.
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly stage?: ErrorStage;
  readonly details?: AppErrorDetail[];
  readonly sunatCode?: string;
  readonly sunatMessage?: string;
  readonly rulesetVersion?: string;

  constructor(params: AppErrorParams) {
    super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
    this.name = "AppError";
    this.code = params.code;
    this.httpStatus = params.httpStatus ?? 400;
    this.retryable = params.retryable ?? false;
    this.stage = params.stage;
    this.details = params.details;
    this.sunatCode = params.sunatCode;
    this.sunatMessage = params.sunatMessage;
    this.rulesetVersion = params.rulesetVersion;
  }

  static validation(
    message: string,
    details?: AppErrorDetail[],
    extras?: Omit<AppErrorParams, "code" | "message" | "details" | "httpStatus">,
  ): AppError {
    return new AppError({
      stage: "request",
      ...extras,
      code: AppErrorCode.VALIDATION,
      message,
      httpStatus: 400,
      details,
    });
  }

  static notFound(
    message: string,
    extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">,
  ): AppError {
    return new AppError({
      ...extras,
      code: AppErrorCode.NOT_FOUND,
      message,
      httpStatus: 404,
    });
  }

  static internal(
    message: string,
    extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus" | "retryable">,
  ): AppError {
    return new AppError({
      ...extras,
      code: AppErrorCode.INTERNAL,
      message,
      httpStatus: 500,
      retryable: true,
    });
  }
}
