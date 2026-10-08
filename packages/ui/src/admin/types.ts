import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";

/** Inject the application's router; shared UI does not own routes or sessions. */
export interface AdminLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}
export type AdminLinkComponent = ComponentType<AdminLinkProps>;

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  exact?: boolean;
  children?: AdminNavItem[];
}
export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}
export function isAdminPathActive(pathname: string, item: AdminNavItem): boolean {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}
