"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const app_error_code_1 = require("./app-error-code");
/**
 * Domain/application error mapped to OpenAPI `Error` by the HTTP exception filter.
 */
class AppError extends Error {
    code;
    httpStatus;
    retryable;
    stage;
    details;
    sunatCode;
    sunatMessage;
    rulesetVersion;
    constructor(params) {
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
    static validation(message, details, extras) {
        return new AppError({
            stage: "request",
            ...extras,
            code: app_error_code_1.AppErrorCode.VALIDATION,
            message,
            httpStatus: extras?.httpStatus ?? 400,
            details,
        });
    }
    static notFound(message, extras) {
        return new AppError({
            ...extras,
            code: app_error_code_1.AppErrorCode.NOT_FOUND,
            message,
            httpStatus: 404,
        });
    }
    static unauthorized(message = "Unauthorized", extras) {
        return new AppError({
            stage: "request",
            ...extras,
            code: app_error_code_1.AppErrorCode.UNAUTHORIZED,
            message,
            httpStatus: 401,
        });
    }
    static forbidden(message = "Forbidden", extras) {
        return new AppError({
            stage: "request",
            ...extras,
            code: app_error_code_1.AppErrorCode.FORBIDDEN,
            message,
            httpStatus: 403,
        });
    }
    static rateLimited(message = "Rate limit exceeded", extras) {
        return new AppError({
            stage: "request",
            ...extras,
            code: app_error_code_1.AppErrorCode.RATE_LIMITED,
            message,
            httpStatus: 429,
            retryable: true,
        });
    }
    static conflict(message, extras) {
        return new AppError({
            ...extras,
            code: app_error_code_1.AppErrorCode.CONFLICT,
            message,
            httpStatus: 409,
        });
    }
    static idempotencyConflict(message = "Idempotency-Key reused with a different request body", extras) {
        return new AppError({
            stage: "request",
            ...extras,
            code: app_error_code_1.AppErrorCode.IDEMPOTENCY_CONFLICT,
            message,
            httpStatus: 409,
        });
    }
    static internal(message, extras) {
        return new AppError({
            ...extras,
            code: app_error_code_1.AppErrorCode.INTERNAL,
            message,
            httpStatus: 500,
            retryable: true,
        });
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app-error.js.map