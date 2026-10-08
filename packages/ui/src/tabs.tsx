import { useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import type { AdminLinkComponent } from "./admin/types";

export function TabNavigation({
  items,
  pathname,
  label,
  LinkComponent = "a",
  className,
}: {
  items: readonly { href: string; label: ReactNode }[];
  pathname: string;
  label: string;
  LinkComponent?: AdminLinkComponent;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800",
        className,
      )}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <LinkComponent
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              active
                ? "border-b-2 border-brand-500 text-gray-800 dark:text-white/90"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90",
            )}
          >
            {item.label}
          </LinkComponent>
        );
      })}
    </nav>
  );
}

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}
export interface TabsProps {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
}
export function Tabs({ items, value, onValueChange, label, className, children }: TabsProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={className}>
      <div
        ref={ref}
        role="tablist"
        aria-label={label}
        className="flex items-center gap-0.5 overflow-x-auto rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          const buttons = Array.from(
            ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [],
          );
          if (!buttons.length) return;
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index + (event.key === "ArrowRight" ? direction : -direction) + buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={item.value === value}
            aria-controls={children ? `${id}-panel` : undefined}
            tabIndex={item.value === value ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-theme-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40",
              item.value === value
                ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children && (
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${items.findIndex((item) => item.value === value)}`}
          className="mt-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
