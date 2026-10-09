import { expect, it } from "vitest";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  parseFixtureRequest,
} from "./index";
import { extendedSale } from "../test-fixtures/competition-scenarios";
import { phase1Request } from "../test-fixtures/commercial-scenarios";
it("preserves extended commercial fields in calculation and XML without double-taxing perception", () => {
  const request = parseFixtureRequest(extendedSale());
  const canonical = hydrateFromFixtureRequest(request);
  expect(canonical.totals).toMatchObject({
    tax_amount: 18,
    tax_inclusive_amount: 118,
    rounding_amount: -0.01,
    perception_amount: 2.36,
    charge_total_amount: 2.36,
    payable_amount: 120.35,
  });
  const xml = new XmlInvoiceBuilder().build(canonical).xml;
  for (const value of [
    "SellerSupplierParty",
    "DeliveryTerms",
    "Shipment",
    "StandardItemIdentification",
    "7751234567892",
    "UsabilityPeriod",
    "PayableRoundingAmount",
    "2000",
    "51",
    "ORD-123",
    "120.35",
  ])
    expect(xml).toContain(value);
  expect(xml).toContain("Valor &lt;uno&gt;");
});
it.each(["01", "02", "03"] as const)("computes perception regime %s", (regime) => {
  const r = phase1Request();
  const amount = { "01": 2.36, "02": 1.18, "03": 0.59 }[regime];
  r.sale_perception = {
    regime,
    base_amount: 118,
    amount,
    total_amount: Number((118 + amount).toFixed(2)),
    customer_is_perception_agent: true,
  };
  expect(hydrateFromFixtureRequest(r).totals.payable_amount).toBe(r.sale_perception.total_amount);
});
it.each([-0.01, 0.01])("applies signed rounding %s without altering taxes", (rounding_amount) => {
  const c = hydrateFromFixtureRequest({ ...phase1Request(), rounding_amount });
  expect(c.totals.payable_amount).toBe(Number((118 + rounding_amount).toFixed(2)));
  expect(c.totals.tax_amount).toBe(18);
  const totals = {
    line_extension_amount: c.totals.line_extension_amount,
    tax_amount: c.totals.tax_amount,
    tax_inclusive_amount: c.totals.tax_inclusive_amount,
    payable_amount: c.totals.payable_amount,
    rounding_amount: c.totals.rounding_amount,
  };
  expect(
    hydrateFromFixtureRequest(
      parseFixtureRequest({ ...phase1Request(), rounding_amount, totals_mode: "strict", totals }),
    ).totals,
  ).toEqual(c.totals);
});
it.each(["07", "08"] as const)("preserves extended fields in note %s", (type) => {
  const r = extendedSale();
  r.embedded_despatch = undefined;
  const c = hydrateNoteFromFixtureRequest(
    {
      ...r,
      note_type: type === "07" ? "01" : "02",
      reason: "Ajuste",
      affected_document: { document_type: "01", serie_number: "F001-1" },
    },
    type,
  );
  const xml = (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(c).xml;
  expect(xml).toContain("120.35");
  expect(xml).toContain("StandardItemIdentification");
  expect(c.seller?.name).toBe(r.seller?.name);
});
it("rejects inconsistent perception totals, unsupported combinations, GTIN and invalid periods", () => {
  const r = extendedSale();
  const perception = r.sale_perception;
  const line = r.lines[0];
  if (!perception || !line) throw new Error("Missing fixture fields");
  perception.amount = 3;
  expect(() => hydrateFromFixtureRequest(r)).toThrow();
  perception.amount = 2.36;
  perception.regime = "03";
  expect(() => hydrateFromFixtureRequest(r)).toThrow();
  line.gs1_product_code = "7751234567893";
  expect(() => parseFixtureRequest(r)).toThrow();
});
it("requires PEN cash sale perception and preserves domestic free bonuses outside its base", () => {
  const r = extendedSale();
  const saleError = expect.objectContaining({
    details: expect.arrayContaining([
      expect.objectContaining({
        path: "sale_perception",
        issue: expect.stringContaining("PEN cash"),
      }),
    ]),
  });
  expect(() => hydrateFromFixtureRequest({ ...r, currency: "USD" })).toThrow(saleError);
  expect(() =>
    hydrateFromFixtureRequest({
      ...r,
      payment_terms: {
        condition: "credit",
        currency: "PEN",
        outstanding_amount: 120.35,
        installments: [{ number: 1, amount: 120.35, due_date: "2026-11-08" }],
      },
    }),
  ).toThrow(saleError);
  const first = r.lines[0];
  if (!first) throw new Error("Missing fixture line");
  r.lines.push({
    ...first,
    id: 2,
    unit_value: 10,
    tax_affectation: "36",
    tax_scheme_id: "9996",
    igv_percent: 0,
  });
  expect(hydrateFromFixtureRequest(r).totals.payable_amount).toBe(120.35);
});
