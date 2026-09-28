import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Layers,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  permission?: string;
  icon: LucideIcon;
}

/** Platform panel nav (S14-PLAT). */
export const NAV_ITEMS: NavItem[] = [
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
];

export const PLATFORM_HOME = "/platform";
export const APP_HOME = "/app";

export function resolveHomePath(
  _perms: readonly string[],
  ctx?: "platform" | "org",
): string {
  return ctx === "org" ? APP_HOME : PLATFORM_HOME;
}
