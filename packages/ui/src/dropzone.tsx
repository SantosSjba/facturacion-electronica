import { useRef, useState, useId, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "./cn";

export interface DropzoneProps {
  title: string;
  description?: string;
  browseLabel?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onReject?: (files: File[]) => void;
  maxSize?: number;
  className?: string;
  children?: ReactNode;
}
export function Dropzone({
  title,
  description,
  browseLabel = "Seleccionar archivo",
  accept,
  multiple,
  disabled,
  onFiles,
  onReject,
  maxSize,
  className,
  children,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const receive = (files: File[]) => {
    if (disabled) return;
    const accepted: File[] = [],
      rejected: File[] = [];
    for (const file of files) {
      const matches =
        !accept ||
        accept.split(",").some((entry) => {
          const rule = entry.trim().toLowerCase();
          return rule.startsWith(".")
            ? file.name.toLowerCase().endsWith(rule)
            : rule.endsWith("/*")
              ? file.type.startsWith(rule.slice(0, -1))
              : file.type === rule;
        });
      if (
        !matches ||
        (maxSize !== undefined && file.size > maxSize) ||
        (!multiple && accepted.length > 0)
      )
        rejected.push(file);
      else accepted.push(file);
    }
    if (rejected.length) onReject?.(rejected);
    if (accepted.length) onFiles(accepted);
  };
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed p-7 lg:p-10",
        dragging
          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
          : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900",
        disabled && "opacity-40",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        receive(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          receive(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby={description ? descriptionId : undefined}
        className="flex w-full flex-col items-center rounded-lg text-center focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20"
      >
        <span className="mb-5 flex size-17 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <UploadCloud aria-hidden="true" className="size-7" />
        </span>
        <span className="mb-2 text-theme-xl font-semibold text-gray-800 dark:text-white/90">
          {title}
        </span>
        {description && (
          <span id={descriptionId} className="mb-4 text-sm text-gray-700 dark:text-gray-400">
            {description}
          </span>
        )}
        <span className="text-sm font-medium text-brand-500 underline">{browseLabel}</span>
      </button>
      {children}
    </div>
  );
}
