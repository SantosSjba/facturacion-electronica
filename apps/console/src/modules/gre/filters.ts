import type { DocumentListParams } from "@/modules/documents/types";
import { DEFAULT_PAGE_SIZE } from "@/shared/ui/Pagination";

export interface GreFiltersState {
  company_id: string;
  /** "" | "09" | "31" | "09,31" */
  document_type: string;
  status: string;
  date_from: string;
  date_to: string;
  serie_number: string;
}

export const EMPTY_GRE_FILTERS: GreFiltersState = {
  company_id: "",
  document_type: "09,31",
  status: "",
  date_from: "",
  date_to: "",
  serie_number: "",
};

export function filtersToParams(
  filters: GreFiltersState,
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

export const GRE_TYPE_OPTIONS = [
  { value: "09,31", label: "09 y 31 (ambas)" },
  { value: "09", label: "09 Remitente" },
  { value: "31", label: "31 Transportista" },
  { value: "", label: "Todos los tipos" },
];

export const GRE_STATUS_OPTIONS = [
  "queued",
  "sent",
  "ticket_pending",
  "accepted",
  "accepted_with_observation",
  "rejected",
  "failed",
  "cancelled",
];
