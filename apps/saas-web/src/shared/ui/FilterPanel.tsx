import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ListFilter, X } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "./components/button";
import { cn } from "./utils";

/**
 * Progressive disclosure for list filters (UX):
 * - Desktop (md+): filters always visible.
 * - Mobile: collapsed by default behind a toggle; badge shows active filters.
 */
export function FilterPanel({
  children,
  activeCount = 0,
  onClear,
  title = "Filtros",
  className,
}: {
  children: ReactNode;
  /** Number of non-empty filter values (drives badge + Limpiar). */
  activeCount?: number;
  onClear?: () => void;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasActive = activeCount > 0;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0 flex-1 justify-between gap-2 sm:flex-none sm:pe-3 sm:ps-3"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="flex items-center gap-2">
            <ListFilter className={buttonIconClassName} />
            <span>{title}</span>
            {hasActive ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                {activeCount}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              buttonIconClassName,
              "transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
        {onClear && hasActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Limpiar filtros"
            onClick={onClear}
          >
            <X className={buttonIconClassName} />
            Limpiar
          </Button>
        ) : null}
      </div>

      <div
        id={panelId}
        className={cn(
          "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]",
          !open && "max-md:hidden",
        )}
      >
        <div className="mb-3 hidden items-center justify-between gap-2 md:flex">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {title}
            {hasActive ? (
              <span className="ms-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {activeCount}
              </span>
            ) : null}
          </p>
          {onClear && hasActive ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-label-sm"
              aria-label="Limpiar filtros"
              onClick={onClear}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Limpiar</ButtonLabel>
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Counts non-empty string filter values (trim-aware). */
export function countActiveFilters(
  values: Record<string, string | null | undefined>,
): number {
  return Object.values(values).filter(
    (value) => typeof value === "string" && value.trim() !== "",
  ).length;
}
