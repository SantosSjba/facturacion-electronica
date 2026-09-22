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
        "mb-6 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
