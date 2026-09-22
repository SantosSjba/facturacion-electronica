import { describe, expect, it } from "vitest";

import { redactAuditData } from "./audit.service";

describe("redactAuditData", () => {
  it("strips secret-like keys nested", () => {
    const out = redactAuditData({
      name: "ok",
      secret: "fsys_xxx",
      nested: { password: "x", token: "y", keep: 1 },
      authorization: "Bearer z",
    }) as Record<string, unknown>;

    expect(out.name).toBe("ok");
    expect(out.secret).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.password).toBe("[REDACTED]");
    expect(nested.token).toBe("[REDACTED]");
    expect(nested.keep).toBe(1);
  });
});
