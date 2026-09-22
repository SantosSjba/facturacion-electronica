import { Loader2 } from "lucide-react";

import { cn } from "./utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({
  label = "Cargando…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-[var(--muted-foreground)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function PageSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-[40vh] items-center justify-center", className)}
    >
      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
    </div>
  );
}
