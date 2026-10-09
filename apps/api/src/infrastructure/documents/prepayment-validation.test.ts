import { describe, it, expect, vi } from "vitest";
import type { Db } from "@factosys/db";
import { validatePrepayments } from "./prepayment-validation";
import { hydrateFromFixtureRequest } from "@factosys/sunat-ubl";
import { phase1Request } from "../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
const r = phase1Request();
const source = {
  status: "accepted",
  currency: r.currency,
  customerIdentityType: r.customer.identity_type,
  customerIdentityNumber: r.customer.identity_number,
  issueDate: "2026-10-01",
  totals: hydrateFromFixtureRequest(r).totals,
};
const prepayment = {
  id: 1,
  document_type: "01" as const,
  serie_number: "F001-1",
  issuer_ruc: "20601234567",
  paid_date: "2026-10-08",
  amount: 23.6,
  base_amount: 20,
  tax_affectation: "10" as const,
};
const input = {
  organizationId: "org",
  companyId: "company",
  companyRuc: "20601234567",
  currency: r.currency,
  customer: r.customer,
  prepayments: [prepayment],
};
function db(row = source, used = "0") {
  return {
    select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve([row]) }) })),
    execute: vi.fn().mockResolvedValue([{ amount: used }]),
  } as unknown as Db;
}
describe("prepayment reconciliation", () => {
  it("accepts a partial prepayment with matching customer/category", async () =>
    expect(validatePrepayments(db(), input)).resolves.toBeUndefined());
  it("rejects normalized duplicates before source lookup", async () => {
    const database = db();
    await expect(
      validatePrepayments(database, {
        ...input,
        prepayments: [prepayment, { ...prepayment, id: 2, serie_number: "F001-00000001" }],
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
    expect(database.select).not.toHaveBeenCalled();
  });
  it.each([
    { status: "queued" },
    { currency: "USD" },
    { customerIdentityNumber: "wrong" },
    { issueDate: "2026-10-09" },
  ])("rejects source mismatch %j", async (extra) =>
    expect(validatePrepayments(db({ ...source, ...extra }), input)).rejects.toMatchObject({
      httpStatus: 422,
    }),
  );
  it("rejects exhausted and invented ISC advances", async () => {
    await expect(validatePrepayments(db(source, "118"), input)).rejects.toMatchObject({
      httpStatus: 422,
    });
    await expect(
      validatePrepayments(db(), {
        ...input,
        prepayments: [{ ...prepayment, isc_amount: 2, isc_system: "01", isc_percent: 10 }],
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
  });
  it("protects a fiscal category even when the source has a larger mixed total", async () => {
    const database = db({ ...source, totals: { ...source.totals, payable_amount: 218 } });
    vi.mocked(database.execute).mockResolvedValue([
      { amount: "94.4", base_amount: "90", isc_amount: "0" },
    ] as never);
    await expect(validatePrepayments(database, input)).rejects.toMatchObject({ httpStatus: 422 });
  });
});
