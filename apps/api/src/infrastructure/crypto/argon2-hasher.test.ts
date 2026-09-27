import { describe, expect, it } from "vitest";

import { Argon2Hasher } from "./argon2-hasher";

describe("Argon2Hasher (argon2id)", () => {
  const hasher = new Argon2Hasher();

  it("hashes and verifies a password", async () => {
    const hash = await hasher.hash("correct-horse-battery");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(hash, "correct-horse-battery")).resolves.toBe(
      true,
    );
  });

  it("rejects a wrong password", async () => {
    const hash = await hasher.hash("correct-horse-battery");
    await expect(hasher.verify(hash, "wrong-password")).resolves.toBe(false);
  });
});
