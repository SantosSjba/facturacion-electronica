import type { HTMLAttributes } from "react";
import { cn } from "./cn";
export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
}
export function Spinner({ label, className, ...props }: SpinnerProps) {
  return (
    <span
      {...props}
      role={label ? "status" : undefined}
      aria-hidden={!label}
      className={cn("inline-flex shrink-0 align-middle", className)}
    >
      <span
        aria-hidden="true"
        className="block size-full min-h-4 min-w-4 rounded-full border-2 border-current border-e-transparent motion-safe:animate-spin"
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
