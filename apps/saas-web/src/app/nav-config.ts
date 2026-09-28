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

export const HOME_FALLBACK = "/platform";

export function resolveHomePath(_perms: readonly string[]): string {
  return HOME_FALLBACK;
}
