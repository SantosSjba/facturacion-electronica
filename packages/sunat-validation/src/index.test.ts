import { describe, expect, it } from "vitest";

import { PACKAGE_NAME } from "./index";

describe("@factosys/sunat-validation", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-validation");
  });
});
