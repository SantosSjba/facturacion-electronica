import { cn } from "../utils";

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "muted" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" &&
          "bg-[var(--accent)] text-[var(--accent-foreground)]",
        variant === "success" && "bg-teal-100 text-teal-900",
        variant === "muted" &&
          "bg-[var(--muted)] text-[var(--muted-foreground)]",
        variant === "outline" &&
          "border border-[var(--border)] text-[var(--foreground)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
