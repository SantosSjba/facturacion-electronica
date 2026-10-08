import { useState, type ReactNode } from "react";
import { cn } from "../cn";
import { CloseIcon, MenuIcon, MoreIcon } from "./icons";
import { useSidebar } from "./sidebar-context";
import type { AdminLinkComponent } from "./types";
export interface AdminHeaderProps {
  homeHref: string;
  logo: ReactNode;
  search?: ReactNode;
  actions: ReactNode;
  LinkComponent: AdminLinkComponent;
  labels: { toggleSidebar: string; actions: string };
}
/** TailAdmin AppHeader markup with injectable search, actions and branding. */
export function AdminHeader({
  homeHref,
  logo,
  search,
  actions,
  LinkComponent,
  labels,
}: AdminHeaderProps) {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobile, isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const handleToggle = () => {
    if (isMobile) toggleMobileSidebar();
    else toggleSidebar();
  };
  const toggleApplicationMenu = () => setApplicationMenuOpen((current) => !current);
  return (
    <header
      data-admin-header
      className="sticky top-0 z-99999 flex w-full border-gray-200 bg-white xl:border-b dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex grow flex-col items-center justify-between xl:flex-row xl:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:gap-4 xl:justify-normal xl:border-b-0 xl:px-0 xl:py-4 dark:border-gray-800">
          <button
            className={`z-99999 flex h-10 w-10 items-center justify-center rounded-lg border-gray-200 text-gray-500 lg:h-11 lg:w-11 lg:bg-transparent xl:border dark:border-gray-800 dark:text-gray-400 dark:lg:bg-transparent ${
              isMobileOpen ? "bg-gray-100 dark:bg-white/3" : ""
            }`}
            type="button"
            aria-expanded={isMobile ? isMobileOpen : isExpanded}
            onClick={handleToggle}
            aria-label={labels.toggleSidebar}
          >
            {isMobileOpen ? <CloseIcon /> : <MenuIcon />}
            {/* Cross Icon */}
          </button>

          <LinkComponent href={homeHref} className="xl:hidden">
            {logo}
          </LinkComponent>

          <button
            aria-label={labels.actions}
            aria-expanded={isApplicationMenuOpen}
            type="button"
            onClick={toggleApplicationMenu}
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 xl:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <MoreIcon />
          </button>

          <div className="hidden xl:block">{search}</div>
        </div>
        <div
          className={cn(
            "flex w-full items-center justify-between gap-4 px-5 py-4 shadow-theme-md xl:flex xl:justify-end xl:px-0 xl:shadow-none",
            isApplicationMenuOpen ? "flex" : "hidden",
          )}
        >
          {actions}
        </div>
      </div>
    </header>
  );
}
