import type { ReactNode } from "react";
import { cn } from "./cn";

export interface FieldStateProps {
  error?: boolean;
  success?: boolean;
  hint?: ReactNode;
}

export function fieldStateClasses(error?: boolean, success?: boolean) {
  return error
    ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:border-error-500 dark:focus:border-error-800"
    : success
      ? "border-success-500 focus:border-success-300 focus:ring-success-500/20 dark:border-success-500 dark:focus:border-success-800"
      : undefined;
}

export function FieldHint({
  id,
  error,
  success,
  children,
}: FieldStateProps & { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn(
        "mt-1.5 text-xs",
        error
          ? "text-error-500"
          : success
            ? "text-success-500"
            : "text-gray-500 dark:text-gray-400",
      )}
    >
      {children}
    </p>
  );
}
