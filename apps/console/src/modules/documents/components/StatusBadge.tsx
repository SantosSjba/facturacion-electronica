import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";

import type { DocumentStatus } from "../types";

const STATUS_META: Record<
  string,
  {
    label: string;
    color: "success" | "error" | "warning" | "muted" | "primary";
    Icon: typeof CheckCircle2;
    spin?: boolean;
  }
> = {
  draft: { label: "Borrador", color: "muted", Icon: CircleDashed },
  validated: { label: "Validado", color: "primary", Icon: CheckCircle2 },
  queued: { label: "En cola", color: "muted", Icon: Clock3 },
  sent: { label: "Enviado", color: "primary", Icon: Send },
  ticket_pending: {
    label: "Ticket pendiente",
    color: "warning",
    Icon: Loader2,
    spin: true,
  },
  accepted: { label: "Aceptado", color: "success", Icon: CheckCircle2 },
  accepted_with_observation: {
    label: "Aceptado c/ obs.",
    color: "warning",
    Icon: AlertTriangle,
  },
  rejected: { label: "Rechazado", color: "error", Icon: XCircle },
  failed: { label: "Fallido", color: "error", Icon: XCircle },
  cancelled: { label: "Anulado", color: "error", Icon: Ban },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    color: "muted" as const,
    Icon: CircleDashed,
  };
  const { label, color, Icon, spin } = meta;

  return (
    <Badge color={color} data-testid="document-status" className="gap-1">
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden />
      {label}
    </Badge>
  );
}
