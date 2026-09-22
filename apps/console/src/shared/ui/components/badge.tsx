import { cn } from "../utils";

type BadgeColor = "primary" | "success" | "error" | "warning" | "muted" | "outline";

export function Badge({
  children,
  className,
  variant = "primary",
  color,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated use `color` — kept for callers using success|muted|outline|default */
  variant?: "default" | "success" | "muted" | "outline" | "error" | BadgeColor;
  color?: BadgeColor;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const resolved: BadgeColor =
    color ??
    (variant === "default"
      ? "primary"
      : (variant as BadgeColor));

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium",
        resolved === "primary" &&
          "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
        resolved === "success" &&
          "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
        resolved === "error" &&
          "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
        resolved === "warning" &&
          "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
        resolved === "muted" &&
          "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400",
        resolved === "outline" &&
          "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-400",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
