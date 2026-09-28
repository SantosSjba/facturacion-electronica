import { cn } from "../utils";

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 rounded border-gray-300 text-brand-500 accent-brand-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700",
        className,
      )}
      {...props}
    />
  );
}
