import type { SignupStatus } from "../api/signups";
import type { OrgStatus } from "../api/orgs";

type BadgeColor = "primary" | "success" | "error" | "warning" | "muted";

export function signupStatusBadge(status: SignupStatus): {
  label: string;
  color: BadgeColor;
} {
  switch (status) {
    case "received":
      return { label: "Recibida", color: "primary" };
    case "under_review":
      return { label: "En revisión", color: "warning" };
    case "approved":
      return { label: "Aprobada", color: "success" };
    case "rejected":
      return { label: "Rechazada", color: "error" };
    default:
      return { label: status, color: "muted" };
  }
}

export function orgStatusBadge(status: OrgStatus): {
  label: string;
  color: BadgeColor;
} {
  return status === "suspended"
    ? { label: "Suspendida", color: "error" }
    : { label: "Activa", color: "success" };
}
