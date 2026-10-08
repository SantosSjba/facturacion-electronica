import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

/** Keep the panel inside the viewport as the header wraps or changes size. */
export function useAdminDropdownPosition(open: boolean, ref: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = ref.current?.querySelector("button");
    if (!anchor) return;
    const update = () => {
      const bounds = anchor.getBoundingClientRect();
      const gap = 16;
      const width = Math.min(384, Math.max(0, window.innerWidth - gap * 2));
      const height = Math.min(480, Math.max(0, window.innerHeight - gap * 2));
      const left = Math.max(gap, Math.min(bounds.right - width, window.innerWidth - width - gap));
      const top = Math.max(gap, Math.min(bounds.bottom + gap, window.innerHeight - height - gap));
      setPosition((current) =>
        current?.left === left &&
        current.top === top &&
        current.width === width &&
        current.height === height
          ? current
          : { left, top, width, height },
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    const header = anchor.closest("header");
    if (header) observer.observe(header);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [open, ref]);
  return position;
}

export function useAdminDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return { open, setOpen, ref };
}
export function AdminDropdownPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute end-0 mt-4 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
      {children}
    </div>
  );
}
