import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { IconTile, type IconTone } from "./detail";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  className?: string;
  actions?: React.ReactNode;
  /** Section icon shown in a tinted tile before the title. */
  icon?: LucideIcon;
  iconTone?: IconTone;
  /** Badges or short facts rendered under the description. */
  meta?: ReactNode;
}

export function PageHeader({
  title,
  description,
  className,
  actions,
  icon,
  iconTone = "brand",
  meta,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? <IconTile icon={icon} tone={iconTone} size="lg" /> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="break-words text-xl font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
