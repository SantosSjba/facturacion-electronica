import { ChevronDown } from "lucide-react";

import { cn } from "../utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pe-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 aria-invalid:border-error-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 dark:disabled:bg-gray-800",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
      />
    </div>
  );
}
