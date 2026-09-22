import { describe, expect, it } from "vitest";

import { validateEnv } from "./env.schema";

describe("validateEnv", () => {
  it("applies defaults when optional vars are missing", () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    expect(env.REDIS_URL).toMatch(/^redis:\/\//);
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(env.RATE_LIMIT_RPM_DEFAULT).toBe(120);
  });

  it("fails with a clear message for invalid PORT", () => {
    expect(() => validateEnv({ PORT: "not-a-number" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("rejects non-postgres DATABASE_URL", () => {
    expect(() => validateEnv({ DATABASE_URL: "mysql://x" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
