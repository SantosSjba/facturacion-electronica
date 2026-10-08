import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const sizes = {
  xsmall: "size-6",
  small: "size-8",
  medium: "size-10",
  large: "size-12",
  xlarge: "size-14",
  xxlarge: "size-16",
};
const indicators = {
  xsmall: "size-1.5",
  small: "size-2",
  medium: "size-2.5",
  large: "size-3",
  xlarge: "size-3.5",
  xxlarge: "size-4",
};
const colors = { online: "bg-success-500", offline: "bg-error-400", busy: "bg-warning-500" };
export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt: string;
  fallback?: ReactNode;
  size?: keyof typeof sizes;
  status?: keyof typeof colors | "none";
  statusLabel?: string;
}
export function Avatar({
  src,
  alt,
  fallback,
  size = "medium",
  status = "none",
  statusLabel,
  className,
  ...props
}: AvatarProps) {
  return (
    <div className={cn("relative shrink-0 rounded-full", sizes[size], className)} {...props}>
      {src ? (
        <img src={src} alt={alt} className="size-full rounded-full object-cover" />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className="flex size-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {fallback ?? alt.slice(0, 2).toUpperCase()}
        </span>
      )}
      {status !== "none" && (
        <span
          role={statusLabel ? "img" : undefined}
          aria-label={statusLabel}
          aria-hidden={!statusLabel}
          className={cn(
            "absolute bottom-0 end-0 rounded-full border-[1.5px] border-white dark:border-gray-900",
            indicators[size],
            colors[status],
          )}
        />
      )}
    </div>
  );
}
