import { describe, expect, it } from "vitest";

import { PACKAGE_NAME } from "./index";

describe("@factosys/pdf-ri", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@factosys/pdf-ri");
  });
});
