import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Button, ButtonLabel, buttonIconClassName, type ButtonProps } from "./button";
import { Spinner } from "./spinner";

export interface ActionButtonProps extends Omit<ButtonProps, "children" | "startIcon" | "loading"> {
  icon: LucideIcon;
  /**
   * Accessible name unless `aria-label` is given. With the default `icon-label*` sizes it is
   * visible from `sm` up (icon-only on mobile); `icon`/`icon-sm` show it only as a tooltip;
   * other sizes always show it.
   */
  label: string;
  /** Shows a spinner in place of the icon and disables the button. */
  pending?: boolean;
}

/** Icon + label action (label collapses to icon-only on mobile). */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      icon: Icon,
      label,
      pending = false,
      variant = "outline",
      size = "icon-label-sm",
      disabled,
      ...props
    },
    ref,
  ) => {
    const iconOnly = size === "icon" || size === "icon-sm";
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        title={iconOnly ? label : undefined}
        {...props}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
      >
        {pending ? (
          <Spinner className={buttonIconClassName} />
        ) : (
          <Icon className={buttonIconClassName} aria-hidden />
        )}
        {iconOnly ? null : size === "icon-label-sm" || size === "icon-label" ? (
          <ButtonLabel>{label}</ButtonLabel>
        ) : (
          label
        )}
      </Button>
    );
  },
);
ActionButton.displayName = "ActionButton";
