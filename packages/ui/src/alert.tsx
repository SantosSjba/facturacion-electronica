import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const styles = {
  success: "border-success-500 bg-success-50 dark:border-success-500/30 dark:bg-success-500/15",
  error: "border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15",
  warning: "border-warning-500 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/15",
  info: "border-blue-light-500 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/15",
};
const iconColors = {
  success: "text-success-500",
  error: "text-error-500",
  warning: "text-warning-500",
  info: "text-blue-light-500",
};
export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant: keyof typeof styles;
  title?: ReactNode;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}
export function Alert({
  variant,
  title,
  message,
  icon,
  action,
  children,
  className,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("rounded-xl border p-4", styles[variant], className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div className={cn("-mt-0.5 shrink-0", iconColors[variant])}>
          {icon ?? (
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.8" />
              {variant === "success" ? (
                <path
                  d="m8.5 12 2.7 2.7 4.3-4.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <>
                  <path
                    d="M12 7.5v6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16.5" r="1" fill="currentColor" />
                </>
              )}
            </svg>
          )}
        </div>
        <div className="min-w-0">
          {title && (
            <h4 className="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
          )}
          {message && <div className="text-sm text-gray-500 dark:text-gray-400">{message}</div>}
          {children}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
