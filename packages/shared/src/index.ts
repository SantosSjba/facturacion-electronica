/**
 * Shared primitives for Factosys packages (errors, Result, logger types later).
 */

export const SHARED_PACKAGE_NAME = "@factosys/shared" as const;

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}

export { AppError } from "./errors/app-error";
export type { AppErrorDetail, AppErrorParams, ErrorStage } from "./errors/app-error";

export { err, ok } from "./result";
export type { Result, ResultErr, ResultOk } from "./result";
