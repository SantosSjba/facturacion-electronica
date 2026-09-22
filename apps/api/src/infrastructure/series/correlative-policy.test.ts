import { describe, expect, it } from "vitest";

import { correlativePolicy } from "./correlative-policy";

describe("correlativePolicy (ADR-001)", () => {
  it("liberates before SUNAT wire", () => {
    expect(correlativePolicy("pre_sign")).toBe("liberate");
    expect(correlativePolicy("pre_sunat")).toBe("liberate");
  });

  it("retains after SendBill or post-send timeout", () => {
    expect(correlativePolicy("post_sendbill")).toBe("retain");
    expect(correlativePolicy("timeout_post_send")).toBe("retain");
  });

  it("consumes on CDR outcomes", () => {
    expect(correlativePolicy("cdr_rejected")).toBe("consume");
    expect(correlativePolicy("cdr_accepted")).toBe("consume");
  });
});
