import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashRequestBody } from "./request-hash";

describe("hashRequestBody", () => {
  it("is stable regardless of key order", () => {
    const a = hashRequestBody({ b: 1, a: 2 });
    const b = hashRequestBody({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs when payload differs", () => {
    expect(hashRequestBody({ x: 1 })).not.toBe(hashRequestBody({ x: 2 }));
  });

  it("matches raw sha256 of canonical JSON", () => {
    const body = { z: true, a: "hi" };
    const expected = createHash("sha256")
      .update(JSON.stringify({ a: "hi", z: true }), "utf8")
      .digest("hex");
    expect(hashRequestBody(body)).toBe(expected);
  });
});
