/**
 * Inputs / outputs for {@link BillServicePort} (doc 24 §C.1 + S6 SendSummary/getStatus).
 */

export interface SendBillInput {
  zipBytes: Buffer;
  /** e.g. `20601234567-01-F001-1.zip` */
  fileName: string;
  /** SOL user = RUC + USER (no password here in logs). */
  solUser: string;
  solPassword: string;
}

export interface SendBillResult {
  rawCdrZip: Buffer;
  statusCode?: string;
  statusMessage?: string;
}

/** SendSummary (RA/RC) — returns ticket for async getStatus. */
export interface SendSummaryInput {
  zipBytes: Buffer;
  /** e.g. `20601234567-RA-20260915-1.zip` */
  fileName: string;
  solUser: string;
  solPassword: string;
}

export interface SendSummaryResult {
  ticket: string;
}

export interface GetStatusInput {
  ticket: string;
  solUser: string;
  solPassword: string;
}

export interface GetStatusResult {
  rawCdrZip: Buffer;
  statusCode?: string;
  statusMessage?: string;
}
