import { Badge } from "@/shared/ui/components/badge";

import type { DocumentStatus } from "../types";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const variant =
    status === "accepted" || status === "accepted_with_observation"
      ? "success"
      : status === "rejected" || status === "failed" || status === "cancelled"
        ? "default"
        : "muted";

  return <Badge variant={variant}>{status}</Badge>;
}
