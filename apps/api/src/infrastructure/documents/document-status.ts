import type { DocumentStatus } from "@factosys/domain";

const ALLOWED: Record<DocumentStatus, readonly DocumentStatus[]> = {
  draft: ["validated", "rejected"],
  validated: ["queued", "ticket_pending", "rejected"],
  queued: ["sent", "failed", "rejected"],
  sent: [
    "accepted",
    "accepted_with_observation",
    "rejected",
    "ticket_pending",
    "failed",
  ],
  ticket_pending: [
    "accepted",
    "accepted_with_observation",
    "rejected",
    "failed",
  ],
  accepted: ["cancelled"],
  accepted_with_observation: ["cancelled"],
  rejected: [],
  failed: ["queued"],
  cancelled: [],
};

export function assertStatusTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  const allowed = ALLOWED[from];
  if (!allowed?.includes(to)) {
    throw new Error(`Invalid document status transition ${from} → ${to}`);
  }
}
