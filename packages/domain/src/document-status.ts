/**
 * Document lifecycle statuses (OpenAPI `DocumentStatus`).
 * Pure domain — no Nest / TypeORM.
 */
export const DocumentStatus = {
  Draft: "draft",
  Validated: "validated",
  Queued: "queued",
  Sent: "sent",
  TicketPending: "ticket_pending",
  Accepted: "accepted",
  AcceptedWithObservation: "accepted_with_observation",
  Rejected: "rejected",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DOCUMENT_STATUS_VALUES: readonly DocumentStatus[] = Object.values(DocumentStatus);
