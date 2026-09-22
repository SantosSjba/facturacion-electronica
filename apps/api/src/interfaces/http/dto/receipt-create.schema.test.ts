import { describe, expect, it } from "vitest";

import { receiptCreateSchema } from "./receipt-create.schema";

const valid = {
  company_id: "11111111-1111-4111-8111-111111111111",
  serie: "B001",
  operation_type: "0101",
  issue_date: "2026-09-17",
  currency: "PEN",
  customer: {
    identity_type: "1",
    identity_number: "12345678",
    name: "JUAN PEREZ",
  },
  lines: [
    {
      id: 1,
      quantity: 2,
      unit_code: "NIU",
      description: "Producto",
      unit_value: 50,
      tax_affectation: "10",
    },
  ],
};

describe("receiptCreateSchema", () => {
  it("accepts boleta B serie", () => {
    expect(receiptCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects factura F serie", () => {
    const r = receiptCreateSchema.safeParse({ ...valid, serie: "F001" });
    expect(r.success).toBe(false);
  });

  it("defaults summary flags", () => {
    const r = receiptCreateSchema.parse(valid);
    expect(r.include_in_daily_summary).toBe(true);
    expect(r.send_individually).toBe(false);
  });
});
