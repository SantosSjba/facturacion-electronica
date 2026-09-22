import { cn } from "../utils";

/**
 * Muted helper / secondary copy — TailAdmin gray-500 / dark gray-400.
 */
export function MutedText({
  className,
  as: Comp = "p",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: "p" | "span" | "dt" | "dd";
}) {
  return (
    <Comp
      className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
      {...props}
    />
  );
}
