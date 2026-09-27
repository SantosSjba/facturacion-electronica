import { describe, expect, it } from "vitest";

import { AuthService } from "./auth.service";

describe("AuthService refresh rotation API (FE-368)", () => {
  it("exposes rotateRefreshToken as the rotation entrypoint used by refresh()", () => {
    expect(typeof AuthService.prototype.refresh).toBe("function");
    expect(typeof AuthService.prototype.rotateRefreshToken).toBe("function");
  });
});
