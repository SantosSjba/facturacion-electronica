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
}
