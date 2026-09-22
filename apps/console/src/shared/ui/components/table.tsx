import { cn } from "../utils";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div
      className={cn(
        "w-full",
        /* Desktop: single bordered surface with horizontal scroll */
        "md:overflow-x-auto md:rounded-xl md:border md:border-gray-200 md:bg-white",
        "dark:md:border-gray-800 dark:md:bg-white/[0.03]",
        /* Mobile: cards are spaced by TBody; no outer chrome */
        "max-md:overflow-visible max-md:border-0 max-md:bg-transparent",
      )}
    >
      <table
        className={cn("w-full caption-bottom text-sm max-md:block", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-gray-100 dark:border-gray-800 max-md:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "divide-y divide-gray-100 dark:divide-gray-800 [&_tr:last-child]:border-0",
        "max-md:block max-md:space-y-3 max-md:divide-y-0",
        className,
      )}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]",
        /* Mobile card: stacked fields + optional actions footer */
        "max-md:grid max-md:grid-cols-1 max-md:gap-y-2",
        "max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:bg-white max-md:p-4 max-md:hover:bg-white",
        "dark:max-md:border-gray-800 dark:max-md:bg-white/[0.03] dark:max-md:hover:bg-white/[0.03]",
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-11 px-5 text-start align-middle text-theme-xs font-medium text-gray-500 dark:text-gray-400",
        className,
      )}
      {...props}
    />
  );
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Field caption shown on mobile cards (hidden on desktop). */
  label?: string;
  /** Renders as the card footer actions row on mobile. */
  actions?: boolean;
}

export function TD({
  className,
  label,
  actions = false,
  children,
  ...props
}: TDProps) {
  return (
    <td
      data-actions={actions ? "" : undefined}
      className={cn(
        "px-5 py-4 align-middle text-theme-sm text-gray-700 dark:text-gray-400",
        actions
          ? cn(
              "text-end",
              "max-md:mt-1 max-md:flex max-md:w-full max-md:flex-row max-md:flex-wrap max-md:items-center max-md:justify-end max-md:gap-2",
              "max-md:border-t max-md:border-gray-100 max-md:px-0 max-md:pb-0 max-md:pt-3",
              "dark:max-md:border-gray-800",
              /* Keep nested action groups horizontal on mobile cards */
              "max-md:[&>div]:flex max-md:[&>div]:flex-row max-md:[&>div]:flex-wrap max-md:[&>div]:items-center max-md:[&>div]:justify-end max-md:[&>div]:gap-2",
            )
          : cn(
              "max-md:flex max-md:items-start max-md:justify-between max-md:gap-3",
              "max-md:border-0 max-md:px-0 max-md:py-0",
            ),
        className,
      )}
      {...props}
    >
      {label && !actions ? (
        <span className="shrink-0 text-theme-xs font-medium text-gray-500 md:hidden dark:text-gray-400">
          {label}
        </span>
      ) : null}
      {actions ? (
        children
      ) : (
        <div className="min-w-0 max-md:text-end md:contents">{children}</div>
      )}
    </td>
  );
}
