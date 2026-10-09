import { FactosysClient } from "./client";
export { encodeCpeTxt } from "./helpers/cpe-txt";
export { FactosysClient } from "./client";
export {
  FactosysError,
  ValidationError,
  SunatRejectedError,
  IdempotencyConflictError,
  mapError,
  isRetryable,
  type FactosysErrorBody,
} from "./errors";
export { verifyWebhookSignature } from "./helpers/webhook-hmac";
export type { FactosysClientOptions, RequestOptions, CompanyLogoResponse } from "./types";

export type { TaxAgentCreate, TaxAgentDocument, ReversionInput } from "./types";

export const PACKAGE_NAME = "@factosys/sdk" as const;

/** Convenience: fetch platform ruleset without API key (public endpoint). */
export async function getRuleset(baseUrl: string): Promise<{
  ruleset_version: string;
  source: string;
  source_sha256: string;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/meta/ruleset`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`getRuleset failed: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    ruleset_version: string;
    source: string;
    source_sha256: string;
  };
}

export { FactosysClient as default };

export type { InvoiceInput, ReceiptInput, NoteInput, CpeDocument } from "./types";

export type { PreviewInput, PreviewValidation, CpeQr } from "./types";
export type { SaleQrInput, VoidedPreviewInput, SummaryPreviewInput } from "./types";

export type { DespatchInput, GreDocument } from "./types";
export type {
  CompanyInput,
  CompanyPatch,
  SeriesInput,
  DocumentShare,
  DocumentDelivery,
  DocumentDetails,
} from "./types";
