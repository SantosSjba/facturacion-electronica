import { expect, it } from "vitest";
import { toTaxAgentCanonical } from "./index";
import { AGENT, taxAgentRequest } from "../test-fixtures/tax-agent-scenarios";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture");
  return value;
}
it.each([
  ["20", "01", 35.4, 1144.6],
  ["40", "01", 23.6, 1203.6],
  ["40", "02", 11.8, 1191.8],
  ["40", "03", 5.9, 1185.9],
] as const)("%s regime %s calculates tax %s and settlement %s", (type, regime, tax, net) => {
  const c = toTaxAgentCanonical(type, taxAgentRequest(type, "PEN", regime), AGENT, 1);
  expect(c.totals).toEqual({ tax_amount: tax, settlement_amount: net });
  expect(c.references[0]?.serie_number).toBe("F001-1");
});
it("converts foreign payment and rounds each amount in cents", () => {
  expect(toTaxAgentCanonical("20", taxAgentRequest("20", "USD"), AGENT, 1).totals).toEqual({
    tax_amount: 132.75,
    settlement_amount: 4292.25,
  });
});
it.each([
  "foreign_no_fx",
  "wrong_fx_date",
  "overpaid",
  "duplicate_document",
  "duplicate_payment",
  "future_payment",
  "boleta",
  "zero_tax",
  "strict_missing",
  "strict_wrong",
  "same_ruc",
  "wrong_regime",
  "wrong_series",
  "precision",
])("rejects %s", (kind) => {
  const b = taxAgentRequest("20");
  const d = required(b.documents[0]),
    p = required(d.payments[0]);
  if (kind === "foreign_no_fx") d.currency = "USD";
  if (kind === "wrong_fx_date") {
    d.currency = "USD";
    p.exchange_rate = {
      source_currency: "USD",
      target_currency: "PEN",
      rate: 3.7,
      date: "2026-10-07",
    };
  }
  if (kind === "overpaid") p.amount = 1181;
  if (kind === "duplicate_document") b.documents.push(structuredClone(d));
  if (kind === "duplicate_payment") d.payments.push(structuredClone(p));
  if (kind === "future_payment") p.date = "2026-10-09";
  if (kind === "boleta") d.document_type = "03";
  if (kind === "zero_tax") p.amount = 0.01;
  if (kind === "strict_missing") b.totals_mode = "strict";
  if (kind === "strict_wrong") {
    p.tax_amount = 35.41;
    p.settlement_amount = 1144.6;
  }
  if (kind === "same_ruc") b.customer.identity_number = AGENT.identity_number;
  if (kind === "wrong_regime") b.regime = "02";
  if (kind === "wrong_series") b.serie = "P001";
  if (kind === "precision") p.amount = 0.001;
  expect(() => toTaxAgentCanonical("20", b, AGENT, 1)).toThrow();
});
it("strict amounts validate per payment and globally", () => {
  const b = taxAgentRequest("40");
  b.totals_mode = "strict";
  b.totals = { tax_amount: 23.6, settlement_amount: 1203.6 };
  Object.assign(required(required(b.documents[0]).payments[0]), b.totals);
  expect(toTaxAgentCanonical("40", b, AGENT, 1).totals).toEqual(b.totals);
});
it("credit notes reduce available total, never generate a payment or tax", () => {
  const b = taxAgentRequest("40"),
    d = required(b.documents[0]);
  d.credit_notes = [{ serie_number: "FC01-3", issue_date: "2026-10-02", total_amount: 180 }];
  required(d.payments[0]).amount = 1000;
  const c = toTaxAgentCanonical("40", b, AGENT, 1);
  expect(c.totals).toEqual({ tax_amount: 20, settlement_amount: 1020 });
  expect(c.references[0]).toMatchObject({
    document_type: "07",
    adjusts_document: { document_type: "01", serie_number: "F001-1" },
  });
  expect(c.references[0]?.payment).toBeUndefined();
  required(d.payments[0]).amount = 1000.01;
  expect(() => toTaxAgentCanonical("40", b, AGENT, 1)).toThrow("credit notes");
});
