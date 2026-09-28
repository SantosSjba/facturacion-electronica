import { Outlet } from "react-router-dom";

import { cn } from "@/shared/ui/utils";

import { AppHeader } from "./layout/AppHeader";
import { AppSidebar } from "./layout/AppSidebar";
import { Backdrop } from "./layout/Backdrop";
import { SidebarProvider, useSidebar } from "./sidebar-context";

function LayoutContent() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={cn(
          "min-w-0 flex-1 transition-[margin] duration-300 ease-in-out",
          isExpanded || isHovered ? "lg:ms-72.5" : "lg:ms-22.5",
          isMobileOpen && "ms-0",
        )}
      >
        <AppHeader />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
