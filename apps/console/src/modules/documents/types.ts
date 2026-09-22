export type DocumentStatus =
  | "draft"
  | "validated"
  | "queued"
  | "sent"
  | "ticket_pending"
  | "accepted"
  | "accepted_with_observation"
  | "rejected"
  | "failed"
  | "cancelled"
  | string;

export interface DocumentCustomer {
  identity_type: string | null;
  identity_number: string | null;
  name: string | null;
}

export interface DocumentPublicError {
  code?: string;
  message?: string;
  sunat_code?: string;
  details?: unknown[];
}

export interface DocumentPublic {
  id: string;
  company_id: string;
  document_type: string;
  serie_number: string | null;
  status: DocumentStatus;
  environment: string;
  issue_date: string | null;
  customer: DocumentCustomer;
  currency: string | null;
  totals: Record<string, unknown> | null;
  sunat_ticket: string | null;
  sunat_code: string | null;
  sunat_message: string | null;
  summary_status: string | null;
  error: DocumentPublicError | null;
  links: {
    self: string;
    xml: string;
    cdr: string;
    pdf: string;
    trace: string;
  };
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  items: DocumentPublic[];
  next_cursor: string | null;
}

export interface DocumentListParams {
  company_id?: string;
  document_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  serie_number?: string;
  limit?: number;
  cursor?: string;
}

export interface DocumentEvent {
  at: string;
  status: string;
  from_status: string | null;
  detail: string | null;
  source: string;
  data: Record<string, unknown>;
}

export interface InvoiceLineInput {
  id: number;
  quantity: number;
  unit_code: string;
  description: string;
  unit_value: number;
  unit_price?: number;
  tax_affectation: string;
  igv_percent?: number;
  tax_scheme_id?: string;
  product_code?: string;
}

export interface CustomerInput {
  identity_type: string;
  identity_number: string;
  name: string;
  email?: string;
  address?: Record<string, unknown>;
}

export interface InvoiceCreateInput {
  company_id: string;
  serie: string;
  number?: number;
  operation_type: string;
  issue_date: string;
  issue_time?: string;
  due_date?: string;
  currency: string;
  totals_mode?: "auto" | "strict";
  purchase_order?: string;
  customer: CustomerInput;
  lines: InvoiceLineInput[];
  legends?: { code: string; text: string }[];
  detraction?: Record<string, unknown>;
  payment_means?: Record<string, unknown>[];
}

export interface ReceiptCreateInput extends Omit<InvoiceCreateInput, "serie"> {
  serie: string;
  include_in_daily_summary?: boolean;
  send_individually?: boolean;
}

export interface NoteCreateInput {
  company_id: string;
  serie: string;
  number?: number;
  issue_date: string;
  currency: string;
  note_type: string;
  reason: string;
  affected_document: {
    document_type: "01" | "03" | "12";
    serie_number: string;
  };
  customer: CustomerInput;
  lines: InvoiceLineInput[];
  totals_mode?: "auto" | "strict";
  include_in_daily_summary?: boolean;
}

export interface VoidedDocumentCreateInput {
  company_id: string;
  reference_date: string;
  issue_date?: string;
  documents: {
    document_type: string;
    serie_number: string;
    reason: string;
  }[];
}

export interface DailySummaryCreateInput {
  company_id: string;
  reference_date: string;
  issue_date?: string;
  document_ids?: string[];
  lines?: {
    document_id?: string;
    document_type?: "03" | "07" | "08";
    serie_number?: string;
    status?: "1" | "2" | "3";
  }[];
}

export const TERMINAL_STATUSES = new Set([
  "accepted",
  "accepted_with_observation",
  "rejected",
  "failed",
  "cancelled",
]);
