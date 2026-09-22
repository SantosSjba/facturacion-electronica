import { describe, expect, it } from "vitest";

import { PACKAGE_NAME } from "./index";

describe("@factosys/sunat-soap", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-soap");
  });
});
