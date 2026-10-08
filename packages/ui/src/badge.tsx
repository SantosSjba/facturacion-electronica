import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeColor =
  "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" | "muted" | "outline";
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "light" | "solid" | "default" | BadgeColor;
  color?: BadgeColor;
  size?: "sm" | "md";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}
const light = {
  primary: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
  info: "bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500",
  light: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
  dark: "bg-gray-500 text-white dark:bg-white/5",
  muted: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400",
  outline: "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-400",
};
const solid = {
  primary: "bg-brand-500 text-white",
  success: "bg-success-500 text-white",
  error: "bg-error-500 text-white",
  warning: "bg-warning-500 text-white",
  info: "bg-blue-light-500 text-white",
  light: "bg-gray-400 text-white dark:bg-white/5 dark:text-white/80",
  dark: "bg-gray-700 text-white",
  muted: "bg-gray-500 text-white",
  outline: light.outline,
};
export function Badge({
  variant = "light",
  color,
  size = "sm",
  startIcon,
  endIcon,
  children,
  className,
  ...props
}: BadgeProps) {
  const resolved =
    color ??
    (variant === "default" || variant === "light" || variant === "solid" ? "primary" : variant);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-medium",
        size === "sm" ? "text-theme-xs" : "text-sm",
        (variant === "solid" ? solid : light)[resolved],
        className,
      )}
      {...props}
    >
      {startIcon && <span className="me-1">{startIcon}</span>}
      {children}
      {endIcon && <span className="ms-1">{endIcon}</span>}
    </span>
  );
}
