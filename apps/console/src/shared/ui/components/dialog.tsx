import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { Button } from "./button";
import { cn } from "../utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  ariaLabel,
  children,
  className,
  closeOnBackdrop = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Setup/teardown must depend only on `open`. Including `onClose` re-ran this
  // on every parent render (new function identity), stole focus from inputs,
  // and felt like "clicking outside" after one keystroke.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-theme-xl outline-none dark:bg-gray-900",
          /* When callers wrap Header/Body/Footer in a <form>, keep the same sticky layout */
          "[&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col [&>form]:overflow-hidden",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title?: string;
  description?: string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const descriptionId = useId();
  return (
    <header
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-8 sm:py-5 dark:border-gray-800",
        className,
      )}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-lg font-semibold text-gray-800 sm:text-xl dark:text-white/90">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p
            id={descriptionId}
            className="mt-1 text-sm text-gray-500 dark:text-gray-400"
          >
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-me-2 -mt-1 shrink-0"
          onClick={onClose}
          aria-label="Cerrar diálogo"
        >
          <X className="size-5" />
        </Button>
      ) : null}
    </header>
  );
}

export function DialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-8 sm:py-6",
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={cn(
        "flex shrink-0 flex-row items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 sm:gap-3 sm:px-8 sm:py-4 dark:border-gray-800",
        /* Equal-width tap targets on narrow screens; auto width from sm up */
        "[&>*]:min-w-0 [&>*]:flex-1 sm:[&>*]:flex-none",
        className,
      )}
      {...props}
    />
  );
}
