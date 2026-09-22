import { describe, expect, it } from "vitest";

import { parseApiError } from "../api/errors";
import { decodeAccessToken } from "./jwt";

describe("parseApiError", () => {
  it("maps typed AppError JSON", () => {
    const err = parseApiError(401, {
      code: "FACTOSYS_UNAUTHORIZED",
      message: "Invalid credentials",
      stage: "auth",
      request_id: "req_1",
      retryable: false,
    });
    expect(err.code).toBe("FACTOSYS_UNAUTHORIZED");
    expect(err.message).toBe("Invalid credentials");
    expect(err.requestId).toBe("req_1");
    expect(err.retryable).toBe(false);
  });
});

describe("decodeAccessToken", () => {
  it("decodes payload claims", () => {
    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: "u1",
        org: "o1",
        email: "owner@demo.local",
        perms: ["companies:read", "users:read"],
        roles: ["owner"],
        typ: "access",
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const headerB64 = header
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `${headerB64}.${payload}.sig`;
    const claims = decodeAccessToken(token);
    expect(claims?.email).toBe("owner@demo.local");
    expect(claims?.perms).toContain("users:read");
  });
});
