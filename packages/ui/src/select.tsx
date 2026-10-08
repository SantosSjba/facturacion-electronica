import { ChevronDownIcon as ChevronDown } from "./admin/icons";
import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { FieldHint, fieldStateClasses, type FieldStateProps } from "./field";
import type { SelectOption } from "./multi-select";

import { cn } from "./cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldStateProps {
  options?: readonly SelectOption[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    children,
    options,
    placeholder,
    onValueChange,
    onChange,
    error,
    success,
    hint,
    ...props
  },
  ref,
) {
  const hintId = useId();
  return (
    <>
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            /* py-0 avoids clipped option text inside fixed-height selects */
            "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-0 pe-11 text-sm leading-none text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 aria-invalid:border-error-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 dark:disabled:bg-gray-800",
            fieldStateClasses(error, success),
            className,
          )}
          {...props}
          aria-invalid={error || props["aria-invalid"]}
          aria-describedby={
            [props["aria-describedby"], hint ? hintId : undefined].filter(Boolean).join(" ") ||
            undefined
          }
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.target.value);
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.text}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        />
      </div>
      {hint && (
        <FieldHint id={hintId} error={error} success={success}>
          {hint}
        </FieldHint>
      )}
    </>
  );
});
