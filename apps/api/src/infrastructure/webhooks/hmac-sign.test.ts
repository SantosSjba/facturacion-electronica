import { describe, expect, it } from "vitest";

import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "./hmac-sign";

describe("webhook HMAC (ADR-004)", () => {
  it("signs and verifies v1 hex", () => {
    const secret = "whsec_test_secret_value";
    const body = JSON.stringify({ event: "document.status_changed" });
    const ts = 1_726_627_200;
    const sig = signWebhookPayload(secret, ts, body);
    expect(sig.startsWith("v1=")).toBe(true);
    expect(verifyWebhookSignature(secret, ts, body, sig)).toBe(true);
    expect(verifyWebhookSignature(secret, ts, body, "v1=deadbeef")).toBe(false);
  });
});
