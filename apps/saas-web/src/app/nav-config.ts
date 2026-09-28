import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  ClipboardList,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  Scale,
  ScrollText,
  Users,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  permission?: string;
  icon: LucideIcon;
}

/** Platform panel nav (S14-PLAT). */
export const PLATFORM_NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/platform",
    icon: LayoutDashboard,
  },
  {
    id: "signup-requests",
    label: "Solicitudes",
    to: "/platform/signup-requests",
    icon: ClipboardList,
  },
  {
    id: "organizations",
    label: "Organizaciones",
    to: "/platform/organizations",
    icon: Building2,
  },
  {
    id: "plans",
    label: "Planes",
    to: "/platform/plans",
    icon: Layers,
  },
  {
    id: "legal",
    label: "Legal",
    to: "/platform/legal",
    icon: Scale,
  },
  {
    id: "audit",
    label: "Auditoría",
    to: "/platform/audit",
    icon: ScrollText,
  },
];

/** Org client panel nav (S15-APP). */
export const ORG_NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Inicio",
    to: "/app",
    icon: Home,
  },
  {
    id: "users",
    label: "Usuarios",
    to: "/app/users",
    permission: "users:read",
    icon: Users,
  },
  {
    id: "companies",
    label: "Empresas",
    to: "/app/companies",
    permission: "companies:read",
    icon: Building2,
  },
  {
    id: "plan",
    label: "Plan",
    to: "/app/plan",
    icon: Layers,
  },
  {
    id: "notifications",
    label: "Notificaciones",
    to: "/app/notifications",
    icon: Bell,
  },
  {
    id: "security",
    label: "Seguridad",
    to: "/app/security",
    icon: KeyRound,
  },
];

/** @deprecated Use PLATFORM_NAV_ITEMS */
export const NAV_ITEMS = PLATFORM_NAV_ITEMS;

export const PLATFORM_HOME = "/platform";
export const APP_HOME = "/app";

export function resolveHomePath(
  _perms: readonly string[],
  ctx?: "platform" | "org",
): string {
  return ctx === "org" ? APP_HOME : PLATFORM_HOME;
}

export function consolePublicUrl(path = ""): string {
  const base = (
    (import.meta.env.VITE_CONSOLE_PUBLIC_URL as string | undefined) ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
