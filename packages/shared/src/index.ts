/**
 * Shared primitives for Factosys packages (errors, Result).
 */

export const SHARED_PACKAGE_NAME = "@factosys/shared" as const;

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}

export { AppErrorCode } from "./errors/app-error-code";
export type { AppErrorCode as AppErrorCodeName } from "./errors/app-error-code";

export { AppError } from "./errors/app-error";
export type { AppErrorDetail, AppErrorParams, ErrorStage } from "./errors/app-error";

export { err, isErr, isOk, ok } from "./result";
export type { Result, ResultErr, ResultOk } from "./result";
