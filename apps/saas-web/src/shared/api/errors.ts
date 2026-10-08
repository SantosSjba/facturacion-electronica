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

const messagesByCode: Record<string, string> = {
  FACTOSYS_VALIDATION: "Revisa los datos ingresados e inténtalo de nuevo.",
  FACTOSYS_UNAUTHORIZED: "Tu sesión no es válida o ha caducado. Inicia sesión nuevamente.",
  FACTOSYS_FORBIDDEN: "No tienes permiso para realizar esta acción.",
  FACTOSYS_NOT_FOUND: "No se encontró el recurso solicitado.",
  FACTOSYS_CONFLICT: "No se pudo completar la acción porque los datos ya existen o han cambiado.",
  FACTOSYS_IDEMPOTENCY_CONFLICT: "Esta solicitud ya se utilizó con datos diferentes.",
  FACTOSYS_RATE_LIMITED: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
  FACTOSYS_INTERNAL: "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.",
  FACTOSYS_SUNAT_REJECTED: "SUNAT rechazó el comprobante. Revisa los detalles de validación.",
};

function spanishApiMessage(status: number, body: ApiErrorBody): string {
  // Specific authentication failures must remain useful without exposing account existence.
  if (body.message === "Invalid credentials") return "El correo o la contraseña son incorrectos.";
  if (status === 0) return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  const codeMessage = body.code ? messagesByCode[body.code] : undefined;
  if (codeMessage) return codeMessage;
  const statusMessages: Record<number, string | undefined> = {
    400: messagesByCode.FACTOSYS_VALIDATION,
    401: messagesByCode.FACTOSYS_UNAUTHORIZED,
    403: messagesByCode.FACTOSYS_FORBIDDEN,
    404: messagesByCode.FACTOSYS_NOT_FOUND,
    409: messagesByCode.FACTOSYS_CONFLICT,
    422: messagesByCode.FACTOSYS_VALIDATION,
    429: messagesByCode.FACTOSYS_RATE_LIMITED,
  };
  return statusMessages[status] ?? "No se pudo completar la solicitud. Inténtalo de nuevo más tarde.";
}

export class ApiError extends Error {
  /** Original backend message for diagnostics, not user-facing copy. */
  readonly serverMessage?: string;
  readonly status: number;
  readonly code: AppErrorCode;
  readonly stage?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(spanishApiMessage(status, body));
    this.serverMessage = body.message;
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || `HTTP_${status}`;
    this.stage = body.stage;
    this.requestId = body.request_id;
    this.retryable = Boolean(body.retryable);
    this.details = body.details;
  }
}

export function getErrorMessage(error: unknown, fallback = "No se pudo completar la acción."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  return fallback;
}

export function parseApiError(status: number, json: unknown): ApiError {
  if (json && typeof json === "object") {
    return new ApiError(status, json as ApiErrorBody);
  }
  return new ApiError(status, { message: `HTTP ${status}` });
}
