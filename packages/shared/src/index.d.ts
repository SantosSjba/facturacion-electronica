/**
 * Shared primitives for Factosys packages (errors, Result).
 */
export declare const SHARED_PACKAGE_NAME: "@factosys/shared";
export declare function assertNever(value: never, message?: string): never;
export { AppErrorCode } from "./errors/app-error-code";
export type { AppErrorCode as AppErrorCodeName } from "./errors/app-error-code";
export { AppError } from "./errors/app-error";
export type { AppErrorDetail, AppErrorParams, ErrorStage } from "./errors/app-error";
export { err, isErr, isOk, ok } from "./result";
export type { Result, ResultErr, ResultOk } from "./result";
//# sourceMappingURL=index.d.ts.map