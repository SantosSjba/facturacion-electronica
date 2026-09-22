/**
 * Inputs / outputs for {@link BillServicePort} (doc 24 §C.1).
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
