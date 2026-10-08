import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Link, type LinkProps } from "react-router-dom";

import { ButtonLabel, buttonIconClassName, buttonVariants, cn } from "@factosys/ui";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

/**
 * Router link styled as an icon + label button. `icon-label*` sizes collapse to icon-only on
 * mobile, `icon-sm` is always icon-only (label as tooltip) and `sm` always shows the label.
 */
export function ActionLink({
  icon: Icon,
  label,
  variant = "outline",
  size = "icon-label-sm",
  iconEnd = false,
  className,
  ...props
}: Omit<LinkProps, "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: "icon-label-sm" | "icon-label" | "icon-sm" | "sm";
  /** Place the icon after the label (e.g. a trailing arrow). */
  iconEnd?: boolean;
}) {
  const iconOnly = size === "icon-sm";
  const icon = <Icon className={buttonIconClassName} aria-hidden />;
  return (
    <Link
      aria-label={label}
      title={iconOnly ? label : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {iconEnd ? null : icon}
      {iconOnly ? null : size === "sm" ? label : <ButtonLabel>{label}</ButtonLabel>}
      {iconEnd ? icon : null}
    </Link>
  );
}

/** Standard "back to list" action for detail pages. */
export function BackLink({ to, label = "Volver" }: { to: string; label?: string }) {
  return <ActionLink to={to} icon={ArrowLeft} label={label} />;
}
