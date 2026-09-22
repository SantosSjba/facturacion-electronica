import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FactosysError,
  ValidationError,
  isRetryable,
  mapError,
  verifyWebhookSignature,
} from "./index";

describe("@factosys/sdk", () => {
  it("maps FACTOSYS_VALIDATION to ValidationError", () => {
    const err = mapError(400, {
      code: "FACTOSYS_VALIDATION",
      message: "bad",
      retryable: false,
      request_id: "rid",
    });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe("FACTOSYS_VALIDATION");
    expect(err.requestId).toBe("rid");
    expect(isRetryable(err)).toBe(false);
  });

  it("isRetryable respects body.retryable", () => {
    const err = new FactosysError(500, {
      code: "FACTOSYS_INTERNAL",
      message: "x",
      retryable: true,
    });
    expect(isRetryable(err)).toBe(true);
  });

  it("verifyWebhookSignature accepts valid v1 HMAC", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ ok: true });
    const ts = Math.floor(Date.now() / 1000);
    const hex = createHmac("sha256", secret)
      .update(`${ts}.${body}`, "utf8")
      .digest("hex");
    expect(
      verifyWebhookSignature(
        body,
        {
          "x-factosys-timestamp": String(ts),
          "x-factosys-signature": `v1=${hex}`,
        },
        secret,
      ),
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        body,
        {
          "x-factosys-timestamp": String(ts),
          "x-factosys-signature": "v1=deadbeef",
        },
        secret,
      ),
    ).toBe(false);
  });
});
