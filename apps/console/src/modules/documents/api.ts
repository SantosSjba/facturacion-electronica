import {
  apiRequest,
  getAccessTokenMemory,
} from "@/shared/api/http-client";
import { fetchCompanies, fetchSeries } from "@/modules/companies/api";
import type { Company, DocumentSeries } from "@/modules/companies/types";

import type {
  DailySummaryCreateInput,
  DocumentEvent,
  DocumentListParams,
  DocumentListResponse,
  DocumentPublic,
  InvoiceCreateInput,
  NoteCreateInput,
  ReceiptCreateInput,
  VoidedDocumentCreateInput,
} from "./types";

function toQuery(params: DocumentListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function fetchDocuments(
  params: DocumentListParams = {},
): Promise<DocumentListResponse> {
  return apiRequest<DocumentListResponse>(`/v1/documents${toQuery(params)}`);
}

export function fetchDocument(id: string): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>(`/v1/documents/${id}`);
}

export function fetchDocumentTrace(id: string): Promise<DocumentEvent[]> {
  return apiRequest<DocumentEvent[]>(`/v1/documents/${id}/trace`);
}

export async function downloadDocumentArtifact(
  id: string,
  kind: "xml" | "cdr" | "pdf",
): Promise<void> {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) || "http://localhost:3000";
  const token = getAccessTokenMemory();
  const res = await fetch(`${base}/v1/documents/${id}/${kind}`, {
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${id}.${kind === "cdr" ? "zip" : kind}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function emitInvoice(
  body: InvoiceCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/invoices", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function emitReceipt(
  body: ReceiptCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/receipts", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function emitCreditNote(
  body: NoteCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/credit-notes", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function emitDebitNote(
  body: NoteCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/debit-notes", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function emitVoidedDocument(
  body: VoidedDocumentCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/voided-documents", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function emitDailySummary(
  body: DailySummaryCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/daily-summaries", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export { fetchCompanies, fetchSeries };
export type { Company, DocumentSeries };
