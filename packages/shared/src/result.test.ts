import { describe, expect, it } from "vitest";

import { err, isErr, isOk, ok } from "./result";

describe("Result", () => {
  it("ok / err helpers and type guards", () => {
    const success = ok(42);
    const failure = err(new Error("nope"));

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    if (isOk(success)) {
      expect(success.value).toBe(42);
    }
    if (isErr(failure)) {
      expect(failure.error.message).toBe("nope");
    }
  });
});
