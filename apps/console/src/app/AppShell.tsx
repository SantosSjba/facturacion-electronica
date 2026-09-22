import { LogOut, Menu, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { filterNavByPermissions } from "@/shared/auth/permissions";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { cn } from "@/shared/ui/utils";

import { NAV_ITEMS } from "./nav-config";

export function AppShell() {
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = useMemo(
    () => filterNavByPermissions(NAV_ITEMS, user?.perms ?? []),
    [user?.perms],
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[var(--fs-sidebar)] text-[var(--fs-sidebar-fg)] transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-wide">FACTOSYS</span>
            <span className="text-[11px] uppercase tracking-wider text-[var(--fs-sidebar-muted)]">
              Console
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-[var(--fs-sidebar-fg)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Principal">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[var(--fs-sidebar-active)] text-white"
                      : "text-[var(--fs-sidebar-muted)] hover:bg-white/5 hover:text-[var(--fs-sidebar-fg)]",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-xs text-[var(--fs-sidebar-muted)]">
            {user?.email}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 text-[var(--fs-sidebar-muted)] hover:text-[var(--fs-sidebar-fg)]"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Cerrar overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold tracking-wide">FACTOSYS</span>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
