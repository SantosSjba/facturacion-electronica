import { apiRequest } from "@/shared/api/http-client";

export type LegalDocumentStatus = "draft" | "published";

export interface LegalDocument {
  id: string;
  code: string;
  version: number;
  title: string;
  body_md: string;
  hash: string;
  status: LegalDocumentStatus;
  published_at: string | null;
  created_at: string;
}

export type LegalWriteBody = {
  code: string;
  version?: number;
  title: string;
  body_md: string;
};

export type LegalPatchBody = {
  title?: string;
  body_md?: string;
  version?: number;
};

export function fetchLegalDocuments(status?: LegalDocumentStatus): Promise<{
  items: LegalDocument[];
}> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/saas/legal/documents${suffix}`);
}

export function createLegalDocument(body: LegalWriteBody): Promise<LegalDocument> {
  return apiRequest("/saas/legal/documents", { method: "POST", body });
}

export function patchLegalDocument(id: string, body: LegalPatchBody): Promise<LegalDocument> {
  return apiRequest(`/saas/legal/documents/${id}`, { method: "PATCH", body });
}

export function publishLegalDocument(id: string): Promise<LegalDocument> {
  return apiRequest(`/saas/legal/documents/${id}/publish`, { method: "POST" });
}
