export type ErrorStage = "request" | "prevalidation" | "sign" | "transport" | "sunat_cdr" | "webhook";
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
export declare class AppError extends Error {
    readonly code: string;
    readonly httpStatus: number;
    readonly retryable: boolean;
    readonly stage?: ErrorStage;
    readonly details?: AppErrorDetail[];
    readonly sunatCode?: string;
    readonly sunatMessage?: string;
    readonly rulesetVersion?: string;
    constructor(params: AppErrorParams);
    static validation(message: string, details?: AppErrorDetail[], extras?: Omit<AppErrorParams, "code" | "message" | "details">): AppError;
    static notFound(message: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">): AppError;
    static unauthorized(message?: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">): AppError;
    static forbidden(message?: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">): AppError;
    static rateLimited(message?: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus" | "retryable">): AppError;
    static conflict(message: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">): AppError;
    static idempotencyConflict(message?: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus">): AppError;
    static internal(message: string, extras?: Omit<AppErrorParams, "code" | "message" | "httpStatus" | "retryable">): AppError;
}
//# sourceMappingURL=app-error.d.ts.map