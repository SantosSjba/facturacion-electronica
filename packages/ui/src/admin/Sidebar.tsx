import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { ChevronDownIcon, MoreIcon } from "./icons";
import { useSidebar } from "./sidebar-context";
import {
  isAdminPathActive,
  type AdminLinkComponent,
  type AdminNavGroup,
  type AdminNavItem,
} from "./types";

export interface AdminSidebarProps {
  groups: AdminNavGroup[];
  pathname: string;
  homeHref: string;
  logo: ReactNode;
  compactLogo: ReactNode;
  LinkComponent: AdminLinkComponent;
  widget?: ReactNode;
  label: string;
}

/** Adapted from TailAdmin AppSidebar: styling/layout retained; navigation injected. */
export function AdminSidebar({
  groups,
  pathname,
  homeHref,
  logo,
  compactLogo,
  LinkComponent,
  widget,
  label,
}: AdminSidebarProps) {
  const { isExpanded, isMobile, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen } =
    useSidebar();
  const showLabels = isExpanded || isHovered || isMobileOpen;
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    setIsMobileOpen(false);
    setIsHovered(false);
    const activeParent = groups
      .flatMap((group) => group.items)
      .find((item) => item.children?.some((child) => isAdminPathActive(pathname, child)));
    setOpenSubmenu(activeParent?.id ?? null);
  }, [pathname, groups, setIsMobileOpen, setIsHovered]);
  useEffect(() => {
    if (openSubmenu)
      setHeights((current) => ({
        ...current,
        [openSubmenu]: refs.current[openSubmenu]?.scrollHeight ?? 0,
      }));
  }, [openSubmenu, showLabels]);

  const renderItem = (item: AdminNavItem) => {
    const active = isAdminPathActive(pathname, item);
    const open = openSubmenu === item.id;
    const content = (
      <>
        <span
          className={cn(
            "menu-item-icon-size",
            (item.children ? open : active) ? "menu-item-icon-active" : "menu-item-icon-inactive",
          )}
        >
          {item.icon}
        </span>
        {showLabels && <span className="menu-item-text">{item.label}</span>}
      </>
    );
    return (
      <li key={item.id}>
        {item.children ? (
          <button
            type="button"
            aria-label={item.label}
            aria-expanded={open}
            onClick={() => setOpenSubmenu((current) => (current === item.id ? null : item.id))}
            className={cn(
              "group menu-item",
              open ? "menu-item-active" : "menu-item-inactive",
              !showLabels && "xl:justify-center",
            )}
          >
            {content}
            {showLabels && (
              <ChevronDownIcon
                className={cn(
                  "ms-auto h-5 w-5 transition-transform duration-200",
                  open && "rotate-180 text-brand-500",
                )}
              />
            )}
          </button>
        ) : (
          <LinkComponent
            href={item.href}
            data-testid={`nav-${item.id}`}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn("group menu-item", active ? "menu-item-active" : "menu-item-inactive")}
          >
            {content}
          </LinkComponent>
        )}
        {item.children && showLabels && (
          <div
            ref={(el) => {
              refs.current[item.id] = el;
            }}
            className="overflow-hidden transition-all duration-300"
            style={{ height: open ? `${heights[item.id] ?? 0}px` : "0px" }}
            inert={!open}
          >
            <ul className="ms-9 mt-2 space-y-1">
              {item.children.map((child) => (
                <li key={child.id}>
                  <LinkComponent
                    href={child.href}
                    data-testid={`nav-${child.id}`}
                    aria-current={isAdminPathActive(pathname, child) ? "page" : undefined}
                    className={cn(
                      "menu-dropdown-item",
                      isAdminPathActive(pathname, child)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive",
                    )}
                  >
                    {child.label}
                  </LinkComponent>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  };
  return (
    <aside
      aria-label={label}
      inert={isMobile && !isMobileOpen}
      data-admin-sidebar
      data-expanded={showLabels}
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out xl:translate-x-0 xl:rtl:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        showLabels ? "w-72.5" : "w-22.5",
        isMobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
      )}
      onMouseEnter={() => !isMobile && !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "flex py-8",
          !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
        )}
      >
        <LinkComponent href={homeHref}>{showLabels ? logo : compactLogo}</LinkComponent>
      </div>
      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.id}>
                  <h2
                    className={cn(
                      "mb-4 flex text-xs leading-5 text-gray-400 uppercase",
                      !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
                    )}
                  >
                    {showLabels ? group.label : <MoreIcon className="size-6" />}
                  </h2>
                  <ul className="flex flex-col gap-4">{group.items.map(renderItem)}</ul>
                </div>
              ))}
          </div>
        </nav>
        {showLabels ? widget : null}
      </div>
    </aside>
  );
}
