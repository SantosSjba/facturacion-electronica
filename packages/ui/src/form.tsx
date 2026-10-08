import { forwardRef, type FormHTMLAttributes } from "react";
import { cn } from "./cn";
export const Form = forwardRef<HTMLFormElement, FormHTMLAttributes<HTMLFormElement>>(
  ({ className, onSubmit, ...props }, ref) => (
    <form
      {...props}
      ref={ref}
      className={cn("space-y-6", className)}
      onSubmit={(event) => {
        if (onSubmit) event.preventDefault();
        onSubmit?.(event);
      }}
    />
  ),
);
Form.displayName = "Form";
