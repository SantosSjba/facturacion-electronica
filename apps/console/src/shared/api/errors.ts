/** Stable AppError codes from API (doc 16) — safe for integrator switch. */
export type AppErrorCode =
  | "FACTOSYS_VALIDATION"
  | "FACTOSYS_UNAUTHORIZED"
  | "FACTOSYS_FORBIDDEN"
  | "FACTOSYS_NOT_FOUND"
  | "FACTOSYS_CONFLICT"
  | "FACTOSYS_IDEMPOTENCY_CONFLICT"
  | "FACTOSYS_RATE_LIMITED"
  | "FACTOSYS_INTERNAL"
  | "FACTOSYS_SUNAT_REJECTED"
  | "FACTOSYS_HTTP"
  | string;

export interface ApiErrorBody {
  code?: AppErrorCode;
  message?: string;
  stage?: string;
  request_id?: string;
  retryable?: boolean;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly stage?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || `HTTP_${status}`;
    this.stage = body.stage;
    this.requestId = body.request_id;
    this.retryable = Boolean(body.retryable);
    this.details = body.details;
  }
}

export function parseApiError(status: number, json: unknown): ApiError {
  if (json && typeof json === "object") {
    return new ApiError(status, json as ApiErrorBody);
  }
  return new ApiError(status, { message: `HTTP ${status}` });
}
