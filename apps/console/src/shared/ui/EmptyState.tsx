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
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
