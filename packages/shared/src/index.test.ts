import { describe, expect, it } from "vitest";

import { SHARED_PACKAGE_NAME, assertNever } from "./index.js";

describe("@factosys/shared", () => {
  it("exports the package name constant", () => {
    expect(SHARED_PACKAGE_NAME).toBe("@factosys/shared");
  });

  it("assertNever throws for unreachable values", () => {
    expect(() => assertNever("impossible" as never, "boom")).toThrow(/boom: impossible/);
  });
});
