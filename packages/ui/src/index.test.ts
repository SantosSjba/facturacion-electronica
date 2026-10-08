import { describe, expect, it } from "vitest";

import { buttonVariants, cn } from "./index";

describe("@factosys/ui", () => {
  it("cn merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("cn keeps TailAdmin font-size tokens next to text colors", () => {
    expect(cn("text-theme-xs", "text-success-600")).toBe("text-theme-xs text-success-600");
    expect(cn("text-theme-xs", "text-sm")).toBe("text-sm");
  });

  it("buttonVariants returns brand classes", () => {
    expect(buttonVariants()).toContain("bg-brand-500");
  });
});
