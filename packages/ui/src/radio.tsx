import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  size?: "sm" | "md";
}
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, size = "md", className, disabled, ...props }, ref) => {
    const control = (
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <input
          {...props}
          ref={ref}
          type="radio"
          disabled={disabled}
          className={cn(
            "peer cursor-pointer appearance-none rounded-full border border-gray-300 checked:border-brand-500 checked:bg-brand-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700",
            size === "sm" ? "size-4" : "size-5",
            className,
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute hidden rounded-full bg-white peer-checked:block",
            size === "sm" ? "size-1.5" : "size-2",
          )}
        />
      </span>
    );
    return label ? (
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-400",
          disabled && "cursor-not-allowed opacity-40",
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
Radio.displayName = "Radio";
export function RadioSm(props: RadioProps) {
  return <Radio {...props} size="sm" />;
}
