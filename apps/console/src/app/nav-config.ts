import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileCheck2,
  FileText,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Truck,
  Users,
  Webhook,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  permission?: string;
  icon: LucideIcon;
}

/** Navigation map from doc 33 §4. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "companies",
    label: "Empresas",
    to: "/companies",
    permission: "companies:read",
    icon: Building2,
  },
  {
    id: "users",
    label: "Usuarios",
    to: "/users",
    permission: "users:read",
    icon: Users,
  },
  {
    id: "documents",
    label: "Comprobantes",
    to: "/documents",
    permission: "documents:read",
    icon: FileText,
  },
  {
    id: "gre",
    label: "GRE",
    to: "/gre",
    permission: "gre:read",
    icon: Truck,
  },
  {
    id: "apikeys",
    label: "API keys",
    to: "/developers/api-keys",
    permission: "apikeys:manage",
    icon: KeyRound,
  },
  {
    id: "webhooks",
    label: "Webhooks",
    to: "/developers/webhooks",
    permission: "webhooks:manage",
    icon: Webhook,
  },
  {
    id: "audit",
    label: "Auditoría",
    to: "/developers/audit",
    permission: "audit:read",
    icon: ScrollText,
  },
  {
    id: "validations",
    label: "Validez CPE",
    to: "/developers/validations",
    permission: "validations:cpe",
    icon: FileCheck2,
  },
];

export const HOME_FALLBACK = "/";

/** Prefer first visible nav item as home destination. */
export function resolveHomePath(perms: readonly string[]): string {
  const first = NAV_ITEMS.find(
    (item) => !item.permission || perms.includes(item.permission),
  );
  return first?.to ?? HOME_FALLBACK;
}

export { ShieldCheck };
