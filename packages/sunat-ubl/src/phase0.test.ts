import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import {
  computeAutoTotals,
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  loadGravadaFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  type InvoiceFixtureRequest,
} from "./index";

function request(count = 2): InvoiceFixtureRequest {
  const base = loadGravadaFixtureRequest();
  return {
    ...base,
    lines: Array.from({ length: count }, (_, i) => ({
      ...required(base.lines[0]),
      id: i + 1,
      description: `PRODUCTO ${i + 1}`,
    })),
  };
}

function nodes(xml: string, name: string): number {
  return new DOMParser()
    .parseFromString(xml, "text/xml")
    .getElementsByTagNameNS(
      "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      name,
    ).length;
}

describe("phase 0 CPE integrity", () => {
  it("serializes small decimal quantities without scientific notation", () => {
    const base = request(1);
    const canonical = hydrateFromFixtureRequest({
      ...base,
      lines: [
        { ...required(base.lines[0]), quantity: 1e-10, unit_value: 1e10, unit_price: undefined },
      ],
    });
    const { xml } = new XmlInvoiceBuilder().build(canonical);
    expect(xml).toContain(">0.0000000001</cbc:InvoicedQuantity>");
    expect(canonical.totals.payable_amount).toBe(1.18);
  });
  it.each([1, 2, 50])("keeps %i invoice and receipt lines", (count) => {
    for (const document_type of ["01", "03"] as const) {
      const canonical = hydrateFromFixtureRequest({
        ...request(count),
        document_type,
        serie: document_type === "01" ? "F001" : "B001",
      });
      const { xml } = new XmlInvoiceBuilder().build(canonical);
      expect(nodes(xml, "InvoiceLine")).toBe(count);
      expect(xml).toContain(`PRODUCTO ${count}`);
      expect(canonical.totals.payable_amount).toBe(count * 118);
    }
  });

  it.each(["07", "08"] as const)("keeps every line and reference in note %s", (type) => {
    const canonical = hydrateNoteFromFixtureRequest(
      {
        ...request(3),
        note_type: "01",
        reason: "Corrección",
        affected_document: { document_type: "01", serie_number: "F001-1" },
      },
      type,
    );
    const { xml } =
      type === "07"
        ? new XmlCreditNoteBuilder().build(canonical)
        : new XmlDebitNoteBuilder().build(canonical);
    expect(nodes(xml, type === "07" ? "CreditNoteLine" : "DebitNoteLine")).toBe(3);
    expect(xml).toContain("PRODUCTO 3");
    expect(xml).toContain("F001-1");
    expect(canonical.totals.payable_amount).toBe(354);
  });

  it("groups mixed taxes independently of first line and separates rates", () => {
    const base = request(1);
    const lines = [
      {
        ...required(base.lines[0]),
        tax_affectation: "20",
        tax_scheme_id: "9997",
        igv_percent: 0,
        unit_price: 100,
      },
      { ...required(base.lines[0]), id: 2 },
      { ...required(base.lines[0]), id: 3, igv_percent: 10, unit_price: 110 },
      {
        ...required(base.lines[0]),
        id: 4,
        tax_affectation: "30",
        tax_scheme_id: "9998",
        igv_percent: 0,
        unit_price: 100,
      },
      {
        ...required(base.lines[0]),
        id: 5,
        tax_affectation: "40",
        tax_scheme_id: "9995",
        igv_percent: 0,
        unit_price: 100,
      },
    ];
    const canonical = hydrateFromFixtureRequest({ ...base, lines });
    expect(canonical.totals).toMatchObject({
      line_extension_amount: 500,
      tax_amount: 28,
      payable_amount: 528,
      taxed_amount: 200,
      exempt_amount: 100,
      unaffected_amount: 100,
      export_amount: 100,
    });
    expect(canonical.totals.tax_subtotals).toHaveLength(5);
    expect(computeAutoTotals({ ...base, lines: [...lines].reverse() }).totals).toEqual(
      canonical.totals,
    );
    const { xml } = new XmlInvoiceBuilder().build(canonical);
    expect(xml).toContain(">EXO</cbc:Name>");
    expect(xml).toContain(">INA</cbc:Name>");
    expect(xml).toContain(">EXP</cbc:Name>");
    expect(xml).not.toContain(">MIXED<");
  });

  it.each(["11", "21", "31", "40"])("never charges free affectation %s", (affectation) => {
    const base = request(1);
    const canonical = hydrateFromFixtureRequest({
      ...base,
      lines: [
        {
          ...required(base.lines[0]),
          tax_affectation: affectation,
          tax_scheme_id: "9996",
          igv_percent: affectation === "11" ? 18 : 0,
          unit_price: 0,
        },
      ],
    });
    expect(canonical.totals).toMatchObject({
      line_extension_amount: 0,
      payable_amount: 0,
      free_amount: 100,
      free_tax_amount: affectation === "11" ? 18 : 0,
    });
    const { xml } = new XmlInvoiceBuilder().build(canonical);
    expect(xml).toContain(">02</cbc:PriceTypeCode>");
    expect(xml).toContain('languageLocaleID="1002"');
    expect(xml).toContain(">GRA</cbc:Name>");
  });

  it("does not collect tax on free lines mixed with an ordinary sale", () => {
    const base = request(2);
    const { totals } = computeAutoTotals({
      ...base,
      lines: [
        required(base.lines[0]),
        { ...required(base.lines[1]), tax_affectation: "11", tax_scheme_id: "9996", unit_price: 0 },
      ],
    });
    expect(totals).toMatchObject({
      payable_amount: 118,
      tax_amount: 36,
      free_tax_amount: 18,
      free_amount: 100,
    });
  });

  it("rounds decimal half-up at the line base then tax, without reducing unit precision", () => {
    const base = request(1);
    const { lines, totals } = computeAutoTotals({
      ...base,
      lines: [{ ...required(base.lines[0]), unit_value: 1.005, unit_price: undefined }],
    });
    expect(lines[0]).toMatchObject({
      line_extension_amount: 1.01,
      tax_amount: 0.18,
      unit_price: 1.1859,
    });
    expect(totals.payable_amount).toBe(1.19);
  });

  it("preserves a supplied rounded unit price and handles large prices without binary tails", () => {
    const base = request(1);
    const canonical = hydrateFromFixtureRequest({
      ...base,
      lines: [{ ...required(base.lines[0]), unit_value: 987654.32, unit_price: 1165432.0976 }],
    });
    expect(new XmlInvoiceBuilder().build(canonical).xml).toContain(
      ">1165432.0976</cbc:PriceAmount>",
    );
    const small = computeAutoTotals({
      ...base,
      lines: [{ ...required(base.lines[0]), unit_value: 0.33333, unit_price: 0.39 }],
    });
    expect(small.lines[0]?.unit_price).toBe(0.39);
  });

  it("validates strict totals and points to the discrepant field", () => {
    const base = request(2);
    const totals = {
      line_extension_amount: 200,
      tax_amount: 36,
      tax_inclusive_amount: 236,
      payable_amount: 236,
    };
    expect(
      computeAutoTotals({ ...base, totals_mode: "strict", totals }).totals.payable_amount,
    ).toBe(236);
    try {
      computeAutoTotals({
        ...base,
        totals_mode: "strict",
        totals: { ...totals, payable_amount: 235.99 },
      });
      expect.fail("Expected a mismatch");
    } catch (error) {
      expect(error).toMatchObject({
        retryable: false,
        details: [{ path: "totals.payable_amount" }],
      });
    }
    expect(() => computeAutoTotals({ ...base, totals_mode: "strict" })).toThrow();
    expect(() => computeAutoTotals({ ...base, totals })).toThrow();
  });

  it("rejects incompatible rate, unit price, scheme and repeated line IDs", () => {
    const base = request(2);
    expect(() =>
      computeAutoTotals({ ...base, lines: [required(base.lines[0]), required(base.lines[0])] }),
    ).toThrow();
    for (const patch of [
      { unit_price: 100 },
      { tax_affectation: "20", tax_scheme_id: "9997" },
      { tax_scheme_id: "9996" },
    ]) {
      expect(() =>
        computeAutoTotals({ ...base, lines: [{ ...required(base.lines[0]), ...patch }] }),
      ).toThrow();
    }
  });

  it("serializes optional fields, escaping user content", () => {
    const base = request(1);
    const canonical = hydrateFromFixtureRequest({
      ...base,
      issue_time: "10:15:30",
      due_date: "2026-10-30",
      purchase_order: "OC<&1",
      legends: [{ code: "1000", text: "CIENTO DIECIOCHO" }],
      customer: {
        ...base.customer,
        email: "cliente@example.com",
        address: { line: "Calle <Uno>", ubigeo: "150101", district: "Lima" },
      },
      lines: [
        { ...required(base.lines[0]), product_code: "PROD-1", sunat_product_code: "10000000" },
      ],
    });
    const { xml } = new XmlInvoiceBuilder().build(canonical);
    for (const text of [
      "10:15:30",
      "2026-10-30",
      "OC&lt;&amp;1",
      "CIENTO DIECIOCHO",
      "Calle &lt;Uno&gt;",
      "150101",
      "cliente@example.com",
      "PROD-1",
      "10000000",
    ])
      expect(xml).toContain(text);
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value");
  return value;
}
