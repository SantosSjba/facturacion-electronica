import { describe, expect, it } from "vitest";
import { CompositeSunatValidationAdapter } from "./index";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  loadGravadaFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
} from "../../sunat-ubl/src/index";

describe("phase 0 XSD and amount consistency gates", () => {
  it.each(["01", "03", "07", "08"] as const)(
    "validates mixed/free multi-line %s with optional fields",
    async (type) => {
      const base = loadGravadaFixtureRequest();
      const request = {
        ...base,
        serie: type === "03" ? "B001" : "F001",
        issue_time: "10:15:30",
        purchase_order: "OC-1",
        legends: [{ code: "1000", text: "TOTAL" }],
        customer: {
          ...base.customer,
          email: "cliente@example.com",
          address: {
            line: "Calle Uno",
            ubigeo: "150101",
            district: "Lima",
            province: "Lima",
            department: "Lima",
          },
        },
        lines: [
          required(base.lines[0]),
          {
            ...required(base.lines[0]),
            id: 2,
            product_code: "P-2",
            sunat_product_code: "10000000",
            tax_affectation: "20",
            tax_scheme_id: "9997",
            igv_percent: 0,
            unit_price: 100,
          },
          {
            ...required(base.lines[0]),
            id: 3,
            tax_affectation: "11",
            tax_scheme_id: "9996",
            unit_price: 0,
          },
        ],
      };
      const xml =
        type === "01" || type === "03"
          ? new XmlInvoiceBuilder().build(
              hydrateFromFixtureRequest({
                ...request,
                document_type: type,
                due_date: "2026-10-30",
              }),
            ).xml
          : (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(
              hydrateNoteFromFixtureRequest(
                {
                  ...request,
                  note_type: "01",
                  reason: "Corrección",
                  affected_document: { document_type: "01", serie_number: "F001-1" },
                },
                type,
              ),
            ).xml;
      const result = await new CompositeSunatValidationAdapter().validateXml({
        documentType: type,
        xml,
        stages: ["xsd", "excel"],
      });
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
      const missingLine = xml.replace(
        /<cac:(InvoiceLine|CreditNoteLine|DebitNoteLine)>[\s\S]*?<\/cac:\1>/,
        "",
      );
      const invalid = await new CompositeSunatValidationAdapter().validateXml({
        documentType: type,
        xml: missingLine,
        stages: ["excel"],
      });
      expect(invalid.ok).toBe(false);
      expect(invalid.issues.some((issue) => issue.message.includes("sum of all lines"))).toBe(true);
    },
  );
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value");
  return value;
}
