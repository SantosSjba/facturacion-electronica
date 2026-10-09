import { describe, expect, it } from "vitest";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
} from "./index";
import { phase1Request, phase1Scenarios } from "../test-fixtures/commercial-scenarios";
describe("phase 1 commercial calculation and UBL", () => {
  it.each(phase1Scenarios().map((request, index) => ({ request, index })))(
    "builds scenario $index",
    ({ request }) => {
      const canonical = hydrateFromFixtureRequest(request);
      const { xml } = new XmlInvoiceBuilder().build(canonical);
      expect(xml).toContain("Invoice");
      expect(canonical.totals.payable_amount).toBeGreaterThanOrEqual(0);
      if (request.payment_terms?.condition === "credit") expect(xml).toContain("Cuota002");
      if (request.prepayments?.length) expect(xml).toContain("PrepaidAmount");
      if (request.detraction) expect(xml).toContain("Detraccion");
    },
  );
  it("deducts advances once and keeps gross invoice amount", () => {
    const request = phase1Scenarios()[2];
    if (!request) throw new Error("Missing scenario");
    const { totals } = hydrateFromFixtureRequest(request);
    expect(totals).toMatchObject({
      taxed_amount: 80,
      tax_amount: 14.4,
      prepaid_amount: 23.6,
      tax_inclusive_amount: 118,
      payable_amount: 94.4,
    });
  });
  it("combines line and global adjustments without taxing non-tax charges", () => {
    const request = phase1Scenarios()[1];
    if (!request) throw new Error("Missing scenario");
    expect(hydrateFromFixtureRequest(request).totals).toMatchObject({
      line_extension_amount: 85,
      taxed_amount: 85,
      tax_amount: 15.3,
      payable_amount: 105.3,
    });
  });
  it.each([
    ["01", 129.8],
    ["02", 123.9],
    ["03", 132.16],
  ] as const)("computes ISC system %s before IGV", (system, total) => {
    const request = phase1Scenarios().find((r) => r.lines[0]?.isc?.system === system);
    if (!request) throw new Error("Missing scenario");
    expect(hydrateFromFixtureRequest(request).totals.payable_amount).toBe(total);
  });
  it("supports zero-fiscal quota correction without changing invoice tax", () => {
    const r = phase1Scenarios()[0];
    if (!r) throw new Error("Missing scenario");
    const c = hydrateNoteFromFixtureRequest(
      {
        ...r,
        lines: r.lines.map((l) => ({ ...l, unit_value: 0 })),
        note_type: "13",
        reason: "Cuotas corregidas",
        affected_document: { document_type: "01", serie_number: "F001-1" },
      },
      "07",
    );
    expect(c.totals.payable_amount).toBe(0);
    expect(new XmlCreditNoteBuilder().build(c).xml).toContain("Cuota002");
  });
  it.each(["07", "08"] as const)("maps line discounts to note %s", (type) => {
    const r = phase1Request();
    const l = r.lines[0];
    if (!l) throw new Error("Missing line");
    const c = hydrateNoteFromFixtureRequest(
      {
        ...r,
        lines: [{ ...l, adjustments: [{ code: "00", base_amount: 100, amount: 10 }] }],
        note_type: type === "07" ? "05" : "02",
        reason: "Ajuste",
        affected_document: { document_type: "01", serie_number: "F001-1" },
      },
      type,
    );
    expect(
      (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(c).xml,
    ).toContain("AllowanceCharge");
  });
  it("rejects inconsistent terms, adjustments, prepayments and taxes", () => {
    const r = phase1Request();
    const l = r.lines[0];
    if (!l) throw new Error("Missing line");
    expect(() =>
      hydrateFromFixtureRequest({
        ...r,
        payment_terms: {
          condition: "credit",
          currency: "PEN",
          outstanding_amount: 119,
          installments: [{ number: 1, due_date: "2026-11-08", amount: 119 }],
        },
      }),
    ).toThrow();
    expect(() =>
      hydrateFromFixtureRequest({
        ...r,
        adjustments: [{ code: "02", base_amount: 100, amount: 10, factor: 0.2 }],
      }),
    ).toThrow();
    expect(() =>
      hydrateFromFixtureRequest({
        ...r,
        lines: [{ ...l, icbper: { quantity: 1, per_unit_amount: 0.4 } }],
      }),
    ).toThrow();
    expect(() =>
      hydrateFromFixtureRequest({
        ...r,
        lines: [
          {
            ...l,
            tax_affectation: "17",
            tax_scheme_id: "1016",
            igv_percent: 4,
            isc: { system: "01", percent: 10 },
          },
        ],
      }),
    ).toThrow();
  });
  it("maps explicit cash and cataloged payment means without recording a collection", () => {
    const c = hydrateFromFixtureRequest({
      ...phase1Request(),
      payment_terms: { condition: "cash" },
      payment_means: [
        {
          code: "001",
          account: "123456",
          bank: "Banco",
          reference: "OP-1",
          due_date: "2026-10-08",
        },
      ],
    });
    const xml = new XmlInvoiceBuilder().build(c).xml;
    expect(xml).toContain("Contado");
    expect(xml).toContain("OP-1");
    expect(xml).toContain("123456");
    expect(c.totals.payable_amount).toBe(118);
    expect(() =>
      hydrateFromFixtureRequest({ ...phase1Request(), payment_means: [{ code: "888" }] }),
    ).toThrow();
  });
});
