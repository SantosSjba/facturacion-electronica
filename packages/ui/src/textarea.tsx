import * as React from "react";

import { cn } from "./cn";
import { FieldHint, fieldStateClasses, type FieldStateProps } from "./field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldStateProps;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, hint, ...props }, ref) => {
    const hintId = React.useId();
    return (
      <>
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 dark:disabled:bg-gray-800",
            fieldStateClasses(error, success),
            className,
          )}
          {...props}
          aria-invalid={error || props["aria-invalid"]}
          aria-describedby={
            [props["aria-describedby"], hint ? hintId : undefined].filter(Boolean).join(" ") ||
            undefined
          }
        />
        {hint && (
          <FieldHint id={hintId} error={error} success={success}>
            {hint}
          </FieldHint>
        )}
      </>
    );
  },
);
Textarea.displayName = "Textarea";
