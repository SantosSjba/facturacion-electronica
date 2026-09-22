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
        "flex flex-col items-start gap-3 rounded-lg border border-[var(--destructive)]/30 bg-[var(--card)] px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--destructive)]"
          aria-hidden
        />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
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
