/**
 * Shared primitives for Factosys packages (errors, Result, logger types later).
 * S0-TOOL: minimal public surface so the monorepo compiles and tests.
 */

export const SHARED_PACKAGE_NAME = "@factosys/shared" as const;

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}
