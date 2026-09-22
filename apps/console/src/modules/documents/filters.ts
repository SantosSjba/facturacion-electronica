import type { DocumentListParams } from "./types";
import { DEFAULT_PAGE_SIZE } from "@/shared/ui/Pagination";

export interface DocumentFiltersState {
  company_id: string;
  document_type: string;
  status: string;
  date_from: string;
  date_to: string;
  serie_number: string;
}

export const EMPTY_DOCUMENT_FILTERS: DocumentFiltersState = {
  company_id: "",
  document_type: "",
  status: "",
  date_from: "",
  date_to: "",
  serie_number: "",
};

export function filtersToParams(
  filters: DocumentFiltersState,
  extras: { limit?: number; cursor?: string } = {},
): DocumentListParams {
  return {
    company_id: filters.company_id || undefined,
    document_type: filters.document_type || undefined,
    status: filters.status || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    serie_number: filters.serie_number || undefined,
    limit: extras.limit ?? DEFAULT_PAGE_SIZE,
    cursor: extras.cursor,
  };
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "01", label: "01 Factura" },
  { value: "03", label: "03 Boleta" },
  { value: "07", label: "07 Nota de crédito" },
  { value: "08", label: "08 Nota de débito" },
  { value: "RA", label: "RA Comunicación de baja" },
  { value: "RC", label: "RC Resumen diario" },
];

export const DOCUMENT_STATUS_OPTIONS = [
  "queued",
  "sent",
  "ticket_pending",
  "accepted",
  "accepted_with_observation",
  "rejected",
  "failed",
  "cancelled",
];
