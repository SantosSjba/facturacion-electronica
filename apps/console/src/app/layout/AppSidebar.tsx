import { Ellipsis, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { filterNavByPermissions } from "@/shared/auth/permissions";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { cn } from "@/shared/ui/utils";

import { NAV_ITEMS } from "../nav-config";
import { useSidebar } from "../sidebar-context";

export function AppSidebar() {
  const { user } = useSession();
  const location = useLocation();
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen, toggleSidebar } =
    useSidebar();
  const showLabels = isExpanded || isHovered || isMobileOpen;
  const visibleNav = useMemo(
    () => filterNavByPermissions(NAV_ITEMS, user?.perms ?? []),
    [user?.perms],
  );

  useEffect(() => setIsMobileOpen(false), [location.pathname, setIsMobileOpen]);

  return (
    <aside
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        showLabels ? "w-72.5" : "w-22.5",
        isMobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn("flex h-24 items-center", showLabels ? "justify-start" : "justify-center")}
      >
        <NavLink to="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-theme-xs">
            FS
          </span>
          {showLabels ? (
            <span>
              <span className="block text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                FACTOSYS
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Consola electrónica
              </span>
            </span>
          ) : null}
        </NavLink>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ms-auto lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <h2
            className={cn(
              "mb-4 flex text-xs leading-5 text-gray-400 uppercase",
              showLabels ? "justify-start" : "justify-center",
            )}
          >
            {showLabels ? "Menú" : <Ellipsis className="size-6" />}
          </h2>
          <ul className="flex flex-col gap-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    data-testid={`nav-${item.id}`}
                    title={showLabels ? undefined : item.label}
                    className={({ isActive }) =>
                      cn(
                        "group menu-item",
                        isActive ? "menu-item-active" : "menu-item-inactive",
                        !showLabels && "justify-center",
                      )
                    }
                  >
                    <Icon className="menu-item-icon-size size-5" />
                    {showLabels ? <span className="menu-item-text">{item.label}</span> : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="hidden border-t border-gray-200 py-4 lg:block dark:border-gray-800">
        <button
          type="button"
          className={cn("menu-item menu-item-inactive w-full", !showLabels && "justify-center")}
          onClick={toggleSidebar}
          aria-label={isExpanded ? "Contraer menú" : "Expandir menú"}
        >
          {isExpanded ? (
            <PanelLeftClose className="size-5" />
          ) : (
            <PanelLeftOpen className="size-5" />
          )}
          {showLabels ? <span>{isExpanded ? "Contraer menú" : "Expandir menú"}</span> : null}
        </button>
      </div>
    </aside>
  );
}
