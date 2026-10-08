import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardTitle } from "./card";
import { cn } from "./cn";
import { MutedText } from "./muted-text";

export type IconTone = "brand" | "success" | "warning" | "error" | "info" | "neutral" | "muted";

const toneClassName: Record<IconTone, string> = {
  brand: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  info: "bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500",
  neutral: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
  muted: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
};

const tileSizeClassName = {
  sm: "size-9 [&>svg]:size-4",
  md: "size-10 [&>svg]:size-4",
  lg: "size-12 [&>svg]:size-5",
};

export interface IconTileProps {
  icon?: LucideIcon;
  tone?: IconTone;
  size?: keyof typeof tileSizeClassName;
  shape?: "rounded" | "circle";
  className?: string;
  /** Rendered instead of the icon (e.g. initials). */
  children?: ReactNode;
}

/** Tinted square (or circle) holding an icon or initials — the visual anchor of cards and rows. */
export function IconTile({
  icon: Icon,
  tone = "brand",
  size = "md",
  shape = "rounded",
  className,
  children,
}: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center text-theme-xs font-semibold",
        shape === "circle" ? "rounded-full" : size === "lg" ? "rounded-2xl" : "rounded-xl",
        tileSizeClassName[size],
        toneClassName[tone],
        className,
      )}
    >
      {children ?? (Icon ? <Icon /> : null)}
    </span>
  );
}

export interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: IconTone;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Card with an icon header (title, optional description and actions) for detail views. */
export function SectionCard({
  title,
  description,
  icon,
  tone = "brand",
  actions,
  className,
  children,
}: SectionCardProps) {
  return (
    <Card className={className}>
      <div
        className={cn("flex flex-wrap items-start justify-between gap-3", children ? "mb-4" : null)}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null}
          <div className="min-w-0">
            <CardTitle className="mb-0">{title}</CardTitle>
            {description ? <MutedText className="mt-0.5">{description}</MutedText> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: IconTone;
  badge?: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  /** Wrap long values instead of truncating them. */
  wrap?: boolean;
  title?: string;
  className?: string;
}

/** Compact status/metric tile: icon, uppercase label and a single value. */
export function StatCard({
  icon,
  label,
  value,
  tone = "neutral",
  badge,
  hint,
  mono,
  wrap,
  title,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-4 sm:p-4", className)}>
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MutedText className="text-xs uppercase tracking-wide">{label}</MutedText>
            {badge}
          </div>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/90",
              wrap ? "break-all" : "truncate",
              mono && "font-mono text-xs",
            )}
            title={title ?? (typeof value === "string" ? value : undefined)}
          >
            {value}
          </p>
          {hint ? <MutedText className="mt-0.5 text-theme-xs">{hint}</MutedText> : null}
        </div>
      </div>
    </Card>
  );
}

/** Two-column description list for label/value pairs. */
export function InfoGrid({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)} {...props} />;
}

export interface InfoFieldProps {
  label: string;
  value?: ReactNode;
  icon?: LucideIcon;
  mono?: boolean;
  className?: string;
}

export function InfoField({ label, value, icon: Icon, mono, className }: InfoFieldProps) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn("min-w-0", className)}>
      <MutedText as="dt" className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        {label}
      </MutedText>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm font-medium text-gray-800 dark:text-white/90",
          mono && "break-all font-mono text-xs",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

export interface EntityCellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Shown instead of the icon (e.g. company or user initials). */
  initials?: string;
  tone?: IconTone;
  className?: string;
}

/** Primary table cell: avatar/icon + name + secondary line. */
export function EntityCell({
  title,
  subtitle,
  icon,
  initials,
  tone = "brand",
  className,
}: EntityCellProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <IconTile icon={icon} tone={tone} size="sm" shape="circle">
        {initials}
      </IconTile>
      <div className="min-w-0 text-start">
        <div className="truncate font-medium text-gray-800 dark:text-white/90">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400 [&>svg]:size-3 [&>svg]:shrink-0">
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Initials for avatars: first letters of the first two meaningful words. */
export function initialsOf(name: string, fallback = "?"): string {
  const words = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(
      (w) =>
        w.length > 1 && !/^(S\.?A\.?C?\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|SAC|SRL|EIRL)$/i.test(w),
    );
  const [first, second] = words;
  if (first && second) return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return fallback.slice(0, 2).toUpperCase() || "?";
}
