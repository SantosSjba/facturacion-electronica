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
  links: { self: string; xml: string; cdr: string; pdf: string; trace: string };
}
