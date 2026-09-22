/**
 * AppError codes aligned with OpenAPI `Error.code`.
 * Values are stable strings; business mapping grows in later sprints.
 */
export declare const AppErrorCode: {
    readonly VALIDATION: "FACTOSYS_VALIDATION";
    readonly HTTP: "FACTOSYS_HTTP";
    readonly INTERNAL: "FACTOSYS_INTERNAL";
    readonly UNAUTHORIZED: "FACTOSYS_UNAUTHORIZED";
    readonly FORBIDDEN: "FACTOSYS_FORBIDDEN";
    readonly NOT_FOUND: "FACTOSYS_NOT_FOUND";
    readonly CONFLICT: "FACTOSYS_CONFLICT";
    readonly IDEMPOTENCY_CONFLICT: "FACTOSYS_IDEMPOTENCY_CONFLICT";
    readonly RATE_LIMITED: "FACTOSYS_RATE_LIMITED";
    readonly SUNAT_REJECTED: "FACTOSYS_SUNAT_REJECTED";
};
export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
//# sourceMappingURL=app-error-code.d.ts.map