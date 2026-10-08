import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  type ButtonHTMLAttributes,
} from "react";
import { cn } from "./cn";
import type { AdminLinkComponent } from "./admin/types";

export interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}
export function Dropdown({
  isOpen,
  onClose,
  triggerRef,
  className,
  children,
  ...props
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        !triggerRef?.current?.contains(event.target)
      )
        onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
      if (
        (!ref.current?.contains(document.activeElement) &&
          !triggerRef?.current?.contains(document.activeElement)) ||
        !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
      )
        return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex="0"]',
        ) ?? [],
      );
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : index < 0
              ? event.key === "ArrowUp"
                ? items.length - 1
                : 0
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [isOpen, onClose, triggerRef]);
  return isOpen ? (
    <div
      ref={ref}
      className={cn(
        "absolute end-0 z-40 mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ) : null;
}
export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  LinkComponent?: AdminLinkComponent;
  onItemClick?: () => void;
  startIcon?: ReactNode;
}
export function DropdownItem({
  href,
  LinkComponent = "a",
  onItemClick,
  startIcon,
  children,
  className,
  onClick,
  ...props
}: DropdownItemProps) {
  const classes = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300",
    className,
  );
  return href ? (
    <LinkComponent href={href} className={classes} onClick={onItemClick}>
      {startIcon}
      {children}
    </LinkComponent>
  ) : (
    <button
      {...props}
      type={props.type ?? "button"}
      className={classes}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onItemClick?.();
      }}
    >
      {startIcon}
      {children}
    </button>
  );
}
