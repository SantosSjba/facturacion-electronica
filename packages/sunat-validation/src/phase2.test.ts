import { it, expect } from "vitest";
import { phase1Request } from "../../sunat-ubl/test-fixtures/commercial-scenarios";
import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
} from "../../sunat-ubl/src/index";
import { CompositeSunatValidationAdapter } from "./index";
it.each(["01", "03", "07", "08"] as const)(
  "validates phase 2 observations XML %s with XSD and local fiscal rules",
  async (type) => {
    const r = {
      ...phase1Request(),
      observations: "Entrega <almacén> & envío",
      pdf_format: "TICKET80" as const,
    };
    const xml =
      type === "01" || type === "03"
        ? new XmlInvoiceBuilder().build(
            hydrateFromFixtureRequest({
              ...r,
              document_type: type,
              serie: type === "01" ? "F001" : "B001",
            }),
          ).xml
        : (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(
            hydrateNoteFromFixtureRequest(
              {
                ...r,
                serie: type === "07" ? "FC01" : "FD01",
                note_type: type === "07" ? "01" : "02",
                reason: "Ajuste",
                affected_document: { document_type: "01", serie_number: "F001-1" },
              },
              type,
            ),
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
    expect(xml).toContain("Entrega &lt;almacén&gt; &amp; envío");
    expect(xml).not.toContain("TICKET80");
  },
);
