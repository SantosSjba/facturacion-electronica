/**
 * GreDespatchPort — send DespatchAdvice ZIP + poll ticket (Spike D).
 */

export const GRE_DESPATCH_PORT: unique symbol = Symbol("GreDespatchPort");

export type GreTicketStatus =
  | "ticket_pending"
  | "accepted"
  | "accepted_with_observation"
  | "rejected";

export interface GreSendDespatchInput {
  accessToken: string;
  zipBytes: Buffer;
  /** e.g. 20601234567-09-T001-1.zip */
  fileName: string;
  /** Emisor RUC (11 digits) — path segment. */
  ruc: string;
  documentType: "09" | "31";
  serie: string;
  number: number;
}

export interface GreSendDespatchResult {
  ticket: string;
  httpStatus: number;
  rawBody?: unknown;
}

export interface GreGetStatusInput {
  accessToken: string;
  ticket: string;
}

export interface GreGetStatusResult {
  status: GreTicketStatus;
  rawCdrZip?: Buffer;
  sunatCode?: string;
  sunatMessage?: string;
  httpStatus: number;
  rawBody?: unknown;
}

export interface GreDespatchPort {
  sendDespatch(input: GreSendDespatchInput): Promise<GreSendDespatchResult>;
  getStatus(input: GreGetStatusInput): Promise<GreGetStatusResult>;
}
