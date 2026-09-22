import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

/**
 * Unit test for AES-256-GCM envelope format used by CredentialsVault
 * (no Nest DI needed).
 */
describe("credentials envelope AES-GCM", () => {
  it("roundtrips JSON payload", () => {
    const key = Buffer.alloc(32, 7);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    expect(JSON.parse(out.toString("utf8"))).toEqual({ hello: "world" });
  });
});
