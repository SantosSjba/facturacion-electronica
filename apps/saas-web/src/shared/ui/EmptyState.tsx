import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "./utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        {description ? (
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
