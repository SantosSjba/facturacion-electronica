/**
 * Stub AppError codes aligned with OpenAPI `Error.code` examples.
 * Values are stable strings; business mapping grows in later sprints.
 */
export const AppErrorCode = {
  VALIDATION: "FACTOSYS_VALIDATION",
  HTTP: "FACTOSYS_HTTP",
  INTERNAL: "FACTOSYS_INTERNAL",
  UNAUTHORIZED: "FACTOSYS_UNAUTHORIZED",
  NOT_FOUND: "FACTOSYS_NOT_FOUND",
  CONFLICT: "FACTOSYS_CONFLICT",
  SUNAT_REJECTED: "FACTOSYS_SUNAT_REJECTED",
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
