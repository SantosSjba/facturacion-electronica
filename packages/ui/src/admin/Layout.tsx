import type { ReactNode } from "react";
import { cn } from "../cn";
import { SidebarProvider, useSidebar } from "./sidebar-context";

export function AdminBackdrop({ label }: { label: string }) {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();
  if (!isMobileOpen) return null;
  return (
    <button
      type="button"
      aria-label={label}
      data-testid="sidebar-backdrop"
      className="fixed inset-0 z-40 bg-gray-900/50 xl:hidden"
      onClick={() => setIsMobileOpen(false)}
    />
  );
}
export interface AdminLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  beforeHeader?: ReactNode;
  overlay?: ReactNode;
  closeSidebarLabel: string;
}
function LayoutContent({
  sidebar,
  header,
  children,
  beforeHeader,
  overlay,
  closeSidebarLabel,
}: AdminLayoutProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  return (
    <div className="min-h-screen xl:flex">
      {sidebar}
      <AdminBackdrop label={closeSidebarLabel} />
      <div
        data-admin-content
        className={cn(
          "min-w-0 flex-1 transition-[margin] duration-300 ease-in-out",
          isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5",
          isMobileOpen && "ms-0",
        )}
      >
        {beforeHeader}
        {header}
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</main>
      </div>
      {overlay}
    </div>
  );
}
export function AdminLayout(props: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent {...props} />
    </SidebarProvider>
  );
}
