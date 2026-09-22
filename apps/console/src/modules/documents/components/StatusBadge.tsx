import { Badge } from "@/shared/ui/components/badge";

import type { DocumentStatus } from "../types";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const color =
    status === "accepted" || status === "accepted_with_observation"
      ? "success"
      : status === "rejected" || status === "failed" || status === "cancelled"
        ? "error"
        : "muted";

  return <Badge color={color} data-testid="document-status">{status}</Badge>;
}
