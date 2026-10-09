import { describe, it, expect } from "vitest";
import { phase1Scenarios, phase1Request } from "../../sunat-ubl/test-fixtures/commercial-scenarios";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
} from "../../sunat-ubl/src/index";
import { CompositeSunatValidationAdapter } from "./index";
describe("phase 1 UBL XSD and fiscal consistency", () => {
  it.each(phase1Scenarios().map((request, index) => ({ request, index })))(
    "validates commercial scenario $index",
    async ({ request }) => {
      const xml = new XmlInvoiceBuilder().build(hydrateFromFixtureRequest(request)).xml;
      const result = await new CompositeSunatValidationAdapter().validateXml({
        documentType: "01",
        xml,
        stages: ["xsd", "excel"],
      });
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );
  it.each(["07", "08"] as const)("validates adjustments in note %s", async (type) => {
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
    const xml = (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(
      c,
    ).xml;
    expect(
      (
        await new CompositeSunatValidationAdapter().validateXml({
          documentType: type,
          xml,
          stages: ["xsd", "excel"],
        })
      ).issues,
    ).toEqual([]);
  });
  it("validates zero-fiscal credit quota correction", async () => {
    const r = phase1Scenarios()[0];
    if (!r) throw new Error("Missing scenario");
    const c = hydrateNoteFromFixtureRequest(
      {
        ...r,
        lines: r.lines.map((l) => ({ ...l, unit_value: 0 })),
        note_type: "13",
        reason: "Cuotas",
        affected_document: { document_type: "01", serie_number: "F001-1" },
      },
      "07",
    );
    expect(
      (
        await new CompositeSunatValidationAdapter().validateXml({
          documentType: "07",
          xml: new XmlCreditNoteBuilder().build(c).xml,
          stages: ["xsd", "excel"],
        })
      ).issues,
    ).toEqual([]);
  });
  it("keeps free ISC noncollectible while collecting bag tax", async () => {
    const r = phase1Request(),
      l = r.lines[0];
    if (!l) throw new Error("Missing line");
    const c = hydrateFromFixtureRequest({
      ...r,
      lines: [
        {
          ...l,
          tax_affectation: "11",
          tax_scheme_id: "9996",
          isc: { system: "01", percent: 10 },
          icbper: { quantity: 1, per_unit_amount: 0.5 },
        },
      ],
    });
    expect(c.totals).toMatchObject({
      free_amount: 100,
      free_tax_amount: 29.8,
      payable_amount: 0.5,
    });
    expect(
      (
        await new CompositeSunatValidationAdapter().validateXml({
          documentType: "01",
          xml: new XmlInvoiceBuilder().build(c).xml,
          stages: ["xsd", "excel"],
        })
      ).issues,
    ).toEqual([]);
  });
});
