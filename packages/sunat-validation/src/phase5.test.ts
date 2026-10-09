import { beforeAll, expect, it } from "vitest";
import {
  XmlTaxAgentBuilder,
  XmlVoidedDocumentsBuilder,
  toTaxAgentCanonical,
} from "../../sunat-ubl/src/index";
import { AGENT, taxAgentRequest } from "../../sunat-ubl/test-fixtures/tax-agent-scenarios";
import {
  generateTestPfx,
  XmlCryptoSignAdapter,
  verifySignedXml,
  loadPfx,
} from "../../sunat-sign/src/index";
import { XmllintXsdValidationAdapter, ExcelP0ValidationAdapter } from "./index";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture");
  return value;
}
let pfx: Buffer;
beforeAll(() => {
  pfx = generateTestPfx("phase5").pfx;
});
it.each([
  ["20", "PEN", "01"],
  ["20", "USD", "01"],
  ["40", "PEN", "01"],
  ["40", "PEN", "02"],
  ["40", "PEN", "03"],
  ["40", "USD", "01"],
] as const)("signed %s/%s/%s matches official UBL 2.0 XSD", async (type, currency, regime) => {
  const canonical = toTaxAgentCanonical(type, taxAgentRequest(type, currency, regime), AGENT, 1);
  const { signedXml } = await new XmlCryptoSignAdapter().sign({
    xml: new XmlTaxAgentBuilder().build(canonical).xml,
    certificate: pfx,
    password: "phase5",
  });
  const result = await new XmllintXsdValidationAdapter().validateXml({
    documentType: type,
    xml: signedXml,
  });
  expect(result.issues).toEqual([]);
  expect(result.ok).toBe(true);
  expect(verifySignedXml(signedXml, loadPfx(pfx, "phase5").certificatePem)).toBe(true);
  const malformed = signedXml.replace(
    /<cbc:IssueDate>[^<]+<\/cbc:IssueDate>/,
    "<cbc:IssueDate>wrong-date</cbc:IssueDate>",
  );
  expect(
    (await new XmllintXsdValidationAdapter().validateXml({ documentType: type, xml: malformed }))
      .ok,
  ).toBe(false);
});
it("signed RR uses VoidedDocuments, generation-date filename and 20/40 lines", async () => {
  const built = new XmlVoidedDocumentsBuilder().build({
    id: "RR-20261008-1",
    issue_date: "2026-10-08",
    reference_date: "2026-10-01",
    supplier: AGENT,
    lines: [
      { line_id: 1, document_type: "20", serie: "R001", number: 1, reason: "Datos incorrectos" },
      { line_id: 2, document_type: "40", serie: "P001", number: 2, reason: "Operación duplicada" },
    ],
  });
  expect(built.fileStem).toBe("20100070970-RR-20261008-1");
  const { signedXml } = await new XmlCryptoSignAdapter().sign({
    xml: built.xml,
    certificate: pfx,
    password: "phase5",
  });
  const result = await new XmllintXsdValidationAdapter().validateXml({
    documentType: "RR",
    xml: signedXml,
  });
  expect(result.issues).toEqual([]);
  expect(result.ok).toBe(true);
});
it("does not claim Excel fiscal coverage for specialized types", async () => {
  expect(
    (
      await new ExcelP0ValidationAdapter().validateXml({
        documentType: "20",
        xml: "",
        stages: ["excel"],
      })
    ).ok,
  ).toBe(false);
});
it.each(["20", "40"] as const)(
  "%s admits related NC without payment/tax elements",
  async (type) => {
    const b = taxAgentRequest(type),
      d = required(b.documents[0]);
    d.credit_notes = [{ serie_number: "FC01-3", issue_date: "2026-10-02", total_amount: 180 }];
    required(d.payments[0]).amount = 1000;
    const c = toTaxAgentCanonical(type, b, AGENT, 1);
    const { signedXml } = await new XmlCryptoSignAdapter().sign({
      xml: new XmlTaxAgentBuilder().build(c).xml,
      certificate: pfx,
      password: "phase5",
    });
    expect(
      (await new XmllintXsdValidationAdapter().validateXml({ documentType: type, xml: signedXml }))
        .issues,
    ).toEqual([]);
  },
);
