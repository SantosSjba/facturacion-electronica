import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { useTheme } from "@/shared/ui/theme-context";
import { useClickOutside } from "@/shared/ui/use-click-outside";
import { cn } from "@/shared/ui/utils";

import { useSidebar } from "../sidebar-context";

export function AppHeader() {
  const { user, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { isMobileOpen, toggleMobileSidebar, setIsMobileOpen } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeUserMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(userMenuRef, closeUserMenu, menuOpen);
  const initials = user?.email.slice(0, 2).toUpperCase() ?? "FS";

  function toggleUserMenu() {
    setMenuOpen((open) => {
      if (!open) setIsMobileOpen(false);
      return !open;
    });
  }

  return (
    <header className="sticky top-0 z-40 flex w-full border-gray-200 bg-white lg:border-b dark:border-gray-800 dark:bg-gray-900">
      <div className="flex grow items-center justify-between px-4 py-3 sm:px-6 lg:py-4">
        {/* Desktop uses sidebar "Contraer menú"; header toggle is mobile-only. */}
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 lg:hidden dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
          onClick={toggleMobileSidebar}
          aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <div className="ms-auto flex items-center gap-2 2xsm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 lg:size-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              className="flex items-center text-gray-700 dark:text-gray-400"
              onClick={toggleUserMenu}
              aria-expanded={menuOpen}
            >
              <span className="me-3 flex size-11 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {initials}
              </span>
              <span className="me-1 hidden max-w-48 text-start text-theme-sm font-medium sm:block">
                <span className="block truncate">{user?.email}</span>
                <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {user?.roles.join(", ") || "Usuario"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "hidden size-4 transition-transform sm:block",
                  menuOpen && "rotate-180",
                )}
              />
            </button>
            {menuOpen ? (
              <div className="absolute end-0 mt-3 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
                <div className="px-2 pb-3">
                  <span className="block truncate text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                    {user?.email}
                  </span>
                  <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                    Sesión protegida
                  </span>
                </div>
                <div className="border-t border-gray-200 py-2 dark:border-gray-800">
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-400">
                    <UserRound className="size-5" /> Mi cuenta
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start text-gray-700 dark:text-gray-400"
                  aria-label="Cerrar sesión"
                  onClick={() => void logout()}
                >
                  <LogOut className={buttonIconClassName} />
                  <ButtonLabel>Cerrar sesión</ButtonLabel>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
