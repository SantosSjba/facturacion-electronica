import { describe, expect, it } from "vitest";

import { buttonVariants, cn } from "./index";

describe("@factosys/ui", () => {
  it("cn merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("buttonVariants returns brand classes", () => {
    expect(buttonVariants()).toContain("bg-brand-500");
  });
});
