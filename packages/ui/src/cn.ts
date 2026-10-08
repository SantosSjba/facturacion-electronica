import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * TailAdmin font-size tokens (`text-theme-*`, `text-title-*`) look like colors to
 * tailwind-merge, which would drop them when merged with `text-<color>` classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "theme-xs",
            "theme-sm",
            "theme-xl",
            "title-sm",
            "title-md",
            "title-lg",
            "title-xl",
            "title-2xl",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
