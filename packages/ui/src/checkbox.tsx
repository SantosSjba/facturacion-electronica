import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, disabled, ...props }, ref) => {
    const control = (
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center align-middle">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-md border border-gray-300 checked:border-transparent checked:bg-brand-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700",
            className,
          )}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute hidden size-3.5 text-white peer-checked:block"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
            stroke="currentColor"
            strokeWidth="1.94437"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
    return label ? (
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-800 dark:text-gray-200",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {control}
        {label}
      </label>
    ) : (
      control
    );
  },
);
Checkbox.displayName = "Checkbox";
