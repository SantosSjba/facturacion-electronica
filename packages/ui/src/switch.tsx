import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "color"> {
  label?: ReactNode;
  color?: "blue" | "gray";
}
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, color = "blue", className, disabled, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-400",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          ref={ref}
          role="switch"
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "h-6 w-11 rounded-full bg-gray-200 transition peer-focus-visible:ring-3 peer-focus-visible:ring-brand-500/20 dark:bg-white/10",
            color === "blue"
              ? "peer-checked:bg-brand-500"
              : "peer-checked:bg-gray-800 dark:peer-checked:bg-white/10",
          )}
        />
        <span
          aria-hidden="true"
          className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-theme-sm transition-transform peer-checked:translate-x-full rtl:peer-checked:-translate-x-full"
        />
      </span>
      {label}
    </label>
  ),
);
Switch.displayName = "Switch";
