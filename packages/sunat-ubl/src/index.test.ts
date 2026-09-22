import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DOMParser } from "@xmldom/xmldom";
import {
  XmlCryptoSignAdapter,
  generateTestPfx,
  loadPfx,
  verifySignedXml,
} from "@factosys/sunat-sign";
import { describe, expect, it } from "vitest";

import {
  BUILD_INVOICE_XML_PORT,
  ListUri,
  PACKAGE_NAME,
  XmlInvoiceBuilder,
  computeAutoTotals,
  documentId,
  hydrateGravadaFixture,
  loadGravadaFixtureRequest,
  resolveTaxPair,
  type BuildInvoiceXmlPort,
} from "./index";

describe("@factosys/sunat-ubl port + types", () => {
  it("exports package name and DI token", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-ubl");
    expect(typeof BUILD_INVOICE_XML_PORT).toBe("symbol");
  });

  it("hydrates fixture to InvoiceCanonical (FE-68)", () => {
    const request = loadGravadaFixtureRequest();
    expect(request.serie.toUpperCase()).toBe("F001");
    const canonical = hydrateGravadaFixture();
    expect(canonical.supplier.identity_number).toBe("20601234567");
    expect(canonical.customer.name).toBe("ACME SAC");
    expect(canonical.lines).toHaveLength(1);
    expect(canonical.document_type).toBe("01");
  });
});

describe("A/B totals + matrix (FE-74)", () => {
  it("resolves pair 10/1000", () => {
    const pair = resolveTaxPair("10", "1000");
    expect(pair.tax_scheme_id).toBe("1000");
    expect(pair.igv_percent_typical).toBe(18);
  });

  it("rejects unknown tax pair", () => {
    expect(() => resolveTaxPair("99", "1000")).toThrow(/Unsupported tax pair/);
  });

  it("computes PayableAmount 118.00 for gravada fixture", () => {
    const request = loadGravadaFixtureRequest();
    const { lines, totals } = computeAutoTotals(request);
    expect(lines[0]?.line_extension_amount).toBe(100);
    expect(lines[0]?.tax_amount).toBe(18);
    expect(totals.payable_amount).toBe(118);
    expect(totals.tax_inclusive_amount).toBe(118);
  });
});

describe("listURI injector (FE-72)", () => {
  it("exposes critical ProfileID attrs", () => {
    const attrs = ListUri.profileId();
    expect(attrs.schemeAgencyName).toBe("PE:SUNAT");
    expect(attrs.schemeURI).toContain("catalogo17");
  });

  it("injects attrs into built XML", () => {
    const { xml } = new XmlInvoiceBuilder().build(hydrateGravadaFixture());
    expect(xml).toContain('schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo17"');
    expect(xml).toContain('listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01"');
    expect(xml).toContain('listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07"');
    expect(xml).toContain('unitCodeListID="UN/ECE rec 20"');
    expect(xml).toContain('schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06"');
  });
});

describe("builder unsigned (FE-70 / FE-76)", () => {
  it("XmlInvoiceBuilder implements BuildInvoiceXmlPort", () => {
    const builder: BuildInvoiceXmlPort = new XmlInvoiceBuilder();
    expect(typeof builder.build).toBe("function");
  });

  it("builds well-formed XML (B1)", () => {
    const canonical = hydrateGravadaFixture();
    const { xml, fileStem } = new XmlInvoiceBuilder().build(canonical);
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    expect(doc.documentElement?.localName || doc.documentElement?.nodeName).toMatch(
      /Invoice/,
    );
    expect(xml).not.toContain("UBLExtensions");
    expect(xml).toContain(`<cbc:ID>${documentId("F001", 1)}</cbc:ID>`);
    expect(xml).toContain("<cbc:PayableAmount");
    expect(xml).toContain(">118.00<");
    expect(fileStem).toBe("20601234567-01-F001-1");
  });

  it("matches golden unsigned structurally (B3)", () => {
    const { xml } = new XmlInvoiceBuilder().build(hydrateGravadaFixture());
    const goldenPath = join(
      process.cwd(),
      "testdata/golden/01-invoice-gravada.unsigned.xml",
    );
    const golden = readFileSync(goldenPath, "utf8");
    expect(normalizeXml(xml)).toBe(normalizeXml(golden));
  });
});

describe("pipeline B→A (FE-78)", () => {
  it("build → sign → verify", async () => {
    const { xml } = new XmlInvoiceBuilder().build(hydrateGravadaFixture());
    const password = "spike-test";
    const { pfx } = generateTestPfx(password);
    const loaded = loadPfx(pfx, password);
    const signed = await new XmlCryptoSignAdapter().sign({
      xml,
      certificate: pfx,
      password,
    });
    expect(signed.signedXml).toMatch(/Signature/);
    expect(verifySignedXml(signed.signedXml, loaded.certificatePem)).toBe(true);
  }, 60_000);
});

function normalizeXml(xml: string): string {
  return xml
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}
