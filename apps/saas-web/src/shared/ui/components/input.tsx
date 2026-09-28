import * as React from "react";

import { cn } from "../utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Native temporal controls that must keep browser pickers fully functional. */
const TEMPORAL_INPUT_TYPES = new Set([
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", onClick, ...props }, ref) => {
    const isTemporal = TEMPORAL_INPUT_TYPES.has(type);

    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 aria-invalid:border-error-500 aria-invalid:focus:border-error-300 aria-invalid:focus:ring-error-500/20 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-400",
          /* appearance-none breaks native date/time pickers in WebKit */
          !isTemporal && "appearance-none",
          isTemporal &&
            cn(
              "cursor-pointer scheme-light dark:scheme-dark",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
              "[&::-webkit-calendar-picker-indicator]:opacity-100",
              "[&::-webkit-calendar-picker-indicator]:brightness-0",
              "dark:[&::-webkit-calendar-picker-indicator]:invert",
            ),
          className,
        )}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (
            !isTemporal ||
            event.defaultPrevented ||
            props.disabled ||
            props.readOnly
          ) {
            return;
          }
          const input = event.currentTarget;
          if (typeof input.showPicker === "function") {
            try {
              input.showPicker();
            } catch {
              /* Browser may reject showPicker outside a trusted gesture */
            }
          }
        }}
      />
    );
  },
);
Input.displayName = "Input";
