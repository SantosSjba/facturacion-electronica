import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      type="file"
      className={cn(
        "h-11 w-full overflow-hidden rounded-lg border border-gray-300 bg-transparent text-sm text-gray-500 shadow-theme-xs transition-colors file:me-5 file:cursor-pointer file:rounded-s-lg file:border-0 file:border-e file:border-solid file:border-gray-200 file:bg-gray-50 file:py-3 file:ps-3.5 file:pe-3 file:text-sm file:text-gray-700 hover:file:bg-gray-100 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:file:border-gray-800 dark:file:bg-white/3 dark:file:text-gray-400",
        className,
      )}
    />
  ),
);
FileInput.displayName = "FileInput";
