import type { InvoiceFixtureRequest, NoteFixtureRequest, InvoiceTotals } from "@factosys/sunat-ubl";
export interface FactosysClientOptions {
  apiKey: string;
  /** Base URL including /v1 or origin only — paths are absolute from host root. */
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export interface CompanyLogoResponse {
  logo: null | {
    content_type: string;
    size_bytes: number;
    width: number;
    height: number;
    sha256: string;
    updated_at: string;
  };
  data_url: string | null;
}

/** Fiscal input shared with the server model; the API allocates correlatives. */
export type InvoiceInput = Omit<InvoiceFixtureRequest, "number" | "document_type">;
export type ReceiptInput = InvoiceInput & {
  include_in_daily_summary?: boolean;
  send_individually?: boolean;
};
export type NoteInput = Omit<NoteFixtureRequest, "number" | "document_type"> & {
  include_in_daily_summary?: boolean;
};
export interface CpeDocument {
  id: string;
  company_id: string;
  document_type: "01" | "03" | "07" | "08";
  serie_number: string;
  status: string;
  totals: InvoiceTotals;
  currency: string;
  issue_date: string;
  printing?: { format: "A4" | "A5" | "TICKET80" | "TICKET58"; template_version: string };
  links: { qr?: string; self: string; xml: string; cdr: string; pdf: string; trace: string };
}

export type PreviewInput =
  | { document_type: "01" | "03"; document: InvoiceInput | ReceiptInput }
  | { document_type: "07" | "08"; document: NoteInput };
export interface PreviewValidation {
  preview: true;
  signed: false;
  sent_to_sunat: false;
  numbering_reserved: false;
  reference_number: 1;
  document_type: string;
  totals: InvoiceTotals;
  validation: "local_business_rules";
  sunat_acceptance: "not_checked";
}
export interface CpeQr {
  payload: string;
  data_url: string;
  size_mm: number;
  modules: number;
  module_mm: number;
  quiet_zone_mm: number;
  error_correction: "Q";
}
