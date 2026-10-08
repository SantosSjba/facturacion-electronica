import type { LucideIcon } from "lucide-react";
import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  CircleOff,
  Clock,
  FilePen,
  FlaskConical,
  Hourglass,
  PauseCircle,
  Rocket,
  RotateCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";

import { Badge, type BadgeColor } from "@factosys/ui";

import { certificateLabel, environmentLabel, statusLabel } from "./display-labels";

const STATUS_META: Record<string, { color: BadgeColor; icon: LucideIcon }> = {
  active: { color: "success", icon: CheckCircle2 },
  success: { color: "success", icon: CheckCircle2 },
  delivered: { color: "success", icon: CheckCircle2 },
  approved: { color: "success", icon: CheckCircle2 },
  published: { color: "success", icon: BadgeCheck },
  disabled: { color: "muted", icon: CircleOff },
  closed: { color: "muted", icon: CircleOff },
  canceled: { color: "muted", icon: XCircle },
  cancelled: { color: "muted", icon: XCircle },
  draft: { color: "muted", icon: FilePen },
  queued: { color: "muted", icon: Clock },
  revoked: { color: "error", icon: Ban },
  suspended: { color: "error", icon: PauseCircle },
  failed: { color: "error", icon: XCircle },
  rejected: { color: "error", icon: XCircle },
  pending: { color: "warning", icon: Clock },
  retrying: { color: "warning", icon: RotateCw },
  under_review: { color: "warning", icon: Search },
  acknowledged: { color: "info", icon: Search },
  received: { color: "primary", icon: Send },
  sent: { color: "info", icon: Send },
  trialing: { color: "info", icon: Hourglass },
};

/** Status pill with a consistent color + icon per status code. */
export function StatusBadge({
  status,
  label,
  color,
  className,
}: {
  status: string;
  /** Overrides the default Spanish label (e.g. feminine "Activa"). */
  label?: string;
  color?: BadgeColor;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? { color: "muted" as const, icon: CircleDashed };
  const Icon = meta.icon;
  return (
    <Badge color={color ?? meta.color} className={className}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {label ?? statusLabel(status)}
    </Badge>
  );
}

/** Sandbox / production pill used across companies and API keys. */
export function EnvironmentBadge({ environment }: { environment: string }) {
  const production = environment === "production";
  const Icon = production ? Rocket : FlaskConical;
  return (
    <Badge color={production ? "warning" : "primary"}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {environmentLabel(environment)}
    </Badge>
  );
}

/** Digital certificate status pill. */
export function CertificateBadge({ status }: { status: string }) {
  const Icon = status === "active" ? ShieldCheck : status === "missing" ? ShieldAlert : ShieldX;
  return (
    <Badge color={status === "active" ? "success" : status === "missing" ? "muted" : "error"}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {certificateLabel(status)}
    </Badge>
  );
}
