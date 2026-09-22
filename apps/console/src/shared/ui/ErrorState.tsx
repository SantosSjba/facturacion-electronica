import { AlertCircle } from "lucide-react";

import { Button } from "./components/button";
import { cn } from "./utils";

export interface ErrorStateProps {
  title?: string;
  message: string;
  className?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Algo salió mal",
  message,
  className,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-error-300 bg-error-50 px-5 py-4 dark:border-error-500/30 dark:bg-error-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 size-5 shrink-0 text-error-500"
          aria-hidden
        />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-error-700 dark:text-error-400">
            {title}
          </h3>
          <p className="text-sm text-error-700/90 dark:text-error-400">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
