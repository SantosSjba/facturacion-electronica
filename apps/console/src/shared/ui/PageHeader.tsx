import { cn } from "./utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  className,
  actions,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
