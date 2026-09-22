import { apiRequest } from "@/shared/api/http-client";
import {
  downloadDocumentArtifact,
  fetchDocument,
  fetchDocuments,
  fetchDocumentTrace,
} from "@/modules/documents/api";
import type { DocumentPublic } from "@/modules/documents/types";
import { fetchCompanies, fetchSeries } from "@/modules/companies/api";

import type { DespatchAdviceCreateInput } from "./types";

export function emitDespatchAdvice(
  body: DespatchAdviceCreateInput,
  idempotencyKey: string,
): Promise<DocumentPublic> {
  return apiRequest<DocumentPublic>("/v1/despatch-advices", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export {
  downloadDocumentArtifact,
  fetchCompanies,
  fetchDocument,
  fetchDocuments,
  fetchDocumentTrace,
  fetchSeries,
};
