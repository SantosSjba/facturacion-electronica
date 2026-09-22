import { describe, expect, it } from "vitest";

import {
  DOCUMENT_STATUS_VALUES,
  DocumentStatus,
  Money,
  DOMAIN_PACKAGE_NAME,
  isValidRuc,
} from "./index";

describe("@factosys/domain", () => {
  it("exports package name", () => {
    expect(DOMAIN_PACKAGE_NAME).toBe("@factosys/domain");
  });

  it("DocumentStatus covers OpenAPI values", () => {
    expect(DocumentStatus.Draft).toBe("draft");
    expect(DOCUMENT_STATUS_VALUES).toContain("ticket_pending");
    expect(DOCUMENT_STATUS_VALUES).toHaveLength(10);
  });

  it("Money VO create returns immutable fields", () => {
    const money = Money.create("100.00", "PEN");
    expect(money.amount).toBe("100.00");
    expect(money.currency).toBe("PEN");
  });

  it("validates RUC checksum", () => {
    expect(isValidRuc("20100070970")).toBe(true);
    expect(isValidRuc("20100070971")).toBe(false);
    expect(isValidRuc("123")).toBe(false);
  });
});
