export type FactosysErrorBody = {
  code: string;
  message: string;
  sunat_code?: string | null;
  sunat_message?: string | null;
  stage?: string;
  retryable?: boolean;
  details?: { path?: string; issue: string }[];
  request_id?: string;
  ruleset_version?: string;
};

export class FactosysError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly stage?: string;
  readonly details?: { path?: string; issue: string }[];
  readonly sunatCode?: string | null;
  readonly sunatMessage?: string | null;
  readonly requestId?: string;
  readonly rulesetVersion?: string;
  readonly body: FactosysErrorBody;

  constructor(httpStatus: number, body: FactosysErrorBody) {
    super(body.message);
    this.name = "FactosysError";
    this.httpStatus = httpStatus;
    this.code = body.code;
    this.retryable = Boolean(body.retryable);
    this.stage = body.stage;
    this.details = body.details;
    this.sunatCode = body.sunat_code;
    this.sunatMessage = body.sunat_message;
    this.requestId = body.request_id;
    this.rulesetVersion = body.ruleset_version;
    this.body = body;
  }
}

export class ValidationError extends FactosysError {
  constructor(httpStatus: number, body: FactosysErrorBody) {
    super(httpStatus, body);
    this.name = "ValidationError";
  }
}

export class SunatRejectedError extends FactosysError {
  constructor(httpStatus: number, body: FactosysErrorBody) {
    super(httpStatus, body);
    this.name = "SunatRejectedError";
  }
}

export class IdempotencyConflictError extends FactosysError {
  constructor(httpStatus: number, body: FactosysErrorBody) {
    super(httpStatus, body);
    this.name = "IdempotencyConflictError";
  }
}

export function mapError(
  httpStatus: number,
  body: FactosysErrorBody,
): FactosysError {
  switch (body.code) {
    case "FACTOSYS_VALIDATION":
      return new ValidationError(httpStatus, body);
    case "FACTOSYS_SUNAT_REJECTED":
      return new SunatRejectedError(httpStatus, body);
    case "FACTOSYS_IDEMPOTENCY_CONFLICT":
      return new IdempotencyConflictError(httpStatus, body);
    default:
      return new FactosysError(httpStatus, body);
  }
}

export function isRetryable(error: unknown): boolean {
  return error instanceof FactosysError && error.retryable;
}
