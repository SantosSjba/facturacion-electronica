import { useEffect, type RefObject } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (target && !ref.current?.contains(target)) onOutside();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOutside();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [enabled, onOutside, ref]);
}
