import { describe, expect, it } from "vitest";

import { invoiceCreateSchema } from "./invoice-create.schema";

const valid = {
  company_id: "01900000-0000-7000-8000-000000000001",
  serie: "F001",
  operation_type: "0101",
  issue_date: "2026-09-17",
  currency: "PEN",
  totals_mode: "auto" as const,
  customer: {
    identity_type: "6",
    identity_number: "20123456789",
    name: "ACME SAC",
  },
  lines: [
    {
      id: 1,
      quantity: 1,
      unit_code: "NIU",
      description: "Servicio de consultoría",
      unit_value: 100,
      unit_price: 118,
      tax_affectation: "10",
      igv_percent: 18,
      tax_scheme_id: "1000",
    },
  ],
};

describe("invoiceCreateSchema", () => {
  it("accepts a valid InvoiceCreate", () => {
    expect(invoiceCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const r = invoiceCreateSchema.safeParse({ serie: "F001" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid serie", () => {
    const r = invoiceCreateSchema.safeParse({ ...valid, serie: "B001" });
    expect(r.success).toBe(false);
  });
});
