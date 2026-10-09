import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";
import { resolveCommonXsdDir, resolveXsdCacheRoot } from "./schemas/paths";
import {
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlSummaryDocumentsBuilder,
} from "../../sunat-ubl/src/index";
import { extendedSale } from "../../sunat-ubl/test-fixtures/competition-scenarios";
import { XmllintXsdValidationAdapter, ExcelP0ValidationAdapter } from "./index";
it.each(["01", "03", "07", "08"] as const)(
  "extended commercial XML %s passes official XSD",
  async (type) => {
    const r = extendedSale();
    let xml: string;
    if (type === "01" || type === "03") {
      r.document_type = type;
      r.serie = type === "01" ? "F001" : "B001";
      xml = new XmlInvoiceBuilder().build(hydrateFromFixtureRequest(r)).xml;
    } else {
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
      xml = (type === "07" ? new XmlCreditNoteBuilder() : new XmlDebitNoteBuilder()).build(c).xml;
    }
    const result = await new XmllintXsdValidationAdapter().validateXml({ documentType: type, xml });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const rules = await new ExcelP0ValidationAdapter().validateXml({
      documentType: type,
      xml,
      stages: ["excel"],
    });
    expect(rules.issues).toEqual([]);
    expect(rules.ok).toBe(true);
  },
);
it("RC perception matches the official SUNAT 1.1 aggregate schema", async () => {
  const common = resolveCommonXsdDir(undefined, "RR");
  // SUNAT distributes the root as 1.0 and the updated summary line aggregate as 1.1.
  const root = readFileSync(
    join(resolveXsdCacheRoot(), "Archivos XSD/2.0/maindoc/UBLPE-SummaryDocuments-1.0.xsd"),
    "utf8",
  ).replace("UBLPE-SunatAggregateComponents-1.0.xsd", "UBLPE-SunatAggregateComponents-1.1.xsd");
  const c = hydrateFromFixtureRequest({ ...extendedSale(), document_type: "03", serie: "B001" });
  const xml = new XmlSummaryDocumentsBuilder().build({
    id: "RC-20261008-1",
    reference_date: "2026-10-08",
    issue_date: "2026-10-09",
    supplier: c.supplier,
    lines: [
      {
        line_id: 1,
        document_type: "03",
        serie_number: "B001-1",
        status: "1",
        customer: c.customer,
        totals: { gravadas: 100, exoneradas: 0, inafectas: 0, igv: 18, payable: 117.99 },
        perception: c.sale_perception,
      },
    ],
  }).xml;
  const result = await validateXML({
    xml: [{ fileName: "document.xml", contents: xml }],
    schema: [{ fileName: "maindoc/UBLPE-SummaryDocuments-1.0.xsd", contents: root }],
    preload: readdirSync(common)
      .filter((n) => n.endsWith(".xsd"))
      .map((n) => ({ fileName: `common/${n}`, contents: readFileSync(join(common, n), "utf8") })),
  });
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
});
