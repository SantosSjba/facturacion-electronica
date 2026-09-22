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
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  XmlDespatchAdviceBuilder,
  XmlInvoiceBuilder,
  XmlSummaryDocumentsBuilder,
  XmlVoidedDocumentsBuilder,
  computeAutoTotals,
  documentId,
  hydrateCreditNoteVoidFixture,
  hydrateDebitNoteInterestFixture,
  hydrateGravadaFixture,
  hydrateReceiptDniFixture,
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

describe("boleta 03 builder (S5-01)", () => {
  it("hydrates DNI receipt fixture", () => {
    const canonical = hydrateReceiptDniFixture();
    expect(canonical.document_type).toBe("03");
    expect(canonical.serie).toBe("B001");
    expect(canonical.customer.identity_type).toBe("1");
    expect(canonical.totals.payable_amount).toBe(118);
  });

  it("builds Invoice root with type 03 and B serie stem", () => {
    const { xml, fileStem } = new XmlInvoiceBuilder().build(
      hydrateReceiptDniFixture(),
    );
    expect(xml).toContain(">03</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:ID>B001-00000001</cbc:ID>");
    expect(fileStem).toBe("20601234567-03-B001-1");
  });

  it("matches golden unsigned boleta structurally", () => {
    const { xml } = new XmlInvoiceBuilder().build(hydrateReceiptDniFixture());
    const goldenPath = join(
      process.cwd(),
      "testdata/golden/03-receipt-dni.unsigned.xml",
    );
    const golden = readFileSync(goldenPath, "utf8");
    expect(normalizeXml(xml)).toBe(normalizeXml(golden));
  });
});

describe("NC/ND builders (S5-03)", () => {
  it("builds CreditNote with BillingReference", () => {
    const { xml, fileStem } = new XmlCreditNoteBuilder().build(
      hydrateCreditNoteVoidFixture(),
    );
    expect(xml).toContain("CreditNote");
    expect(xml).toContain("DiscrepancyResponse");
    expect(xml).toContain("BillingReference");
    expect(xml).toContain("F001-00000001");
    expect(xml).toContain("CreditedQuantity");
    expect(fileStem).toBe("20601234567-07-F001-1");
  });

  it("matches golden credit note structurally", () => {
    const { xml } = new XmlCreditNoteBuilder().build(
      hydrateCreditNoteVoidFixture(),
    );
    const golden = readFileSync(
      join(process.cwd(), "testdata/golden/07-credit-note-void.unsigned.xml"),
      "utf8",
    );
    expect(normalizeXml(xml)).toBe(normalizeXml(golden));
  });

  it("builds DebitNote with interest line", () => {
    const { xml, fileStem } = new XmlDebitNoteBuilder().build(
      hydrateDebitNoteInterestFixture(),
    );
    expect(xml).toContain("DebitNote");
    expect(xml).toContain("DebitedQuantity");
    expect(xml).toContain(">23.60<");
    expect(fileStem).toBe("20601234567-08-F001-1");
  });

  it("matches golden debit note structurally", () => {
    const { xml } = new XmlDebitNoteBuilder().build(
      hydrateDebitNoteInterestFixture(),
    );
    const golden = readFileSync(
      join(process.cwd(), "testdata/golden/08-debit-note-interest.unsigned.xml"),
      "utf8",
    );
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

describe("RA VoidedDocuments builder (FE-194)", () => {
  it("builds VoidedDocuments with ReferenceDate and lines", () => {
    const { xml, fileStem } = new XmlVoidedDocumentsBuilder().build({
      id: "RA-20260915-00001",
      reference_date: "2026-09-15",
      issue_date: "2026-09-16",
      supplier: {
        identity_type: "6",
        identity_number: "20601234567",
        name: "FACTOSYS DEMO SAC",
      },
      lines: [
        {
          line_id: 1,
          document_type: "01",
          serie: "F001",
          number: 99,
          reason: "Error en datos; comprobante no otorgado",
        },
      ],
    });
    expect(xml).toContain("VoidedDocuments");
    expect(xml).toContain("<cbc:ReferenceDate>2026-09-15</cbc:ReferenceDate>");
    expect(xml).toContain("<sac:DocumentSerialID>F001</sac:DocumentSerialID>");
    expect(fileStem).toBe("20601234567-RA-20260915-1");
  });
});

describe("RC SummaryDocuments builder (FE-197)", () => {
  it("builds SummaryDocuments CustomizationID 1.1", () => {
    const { xml, fileStem } = new XmlSummaryDocumentsBuilder().build({
      id: "RC-20260917-00001",
      reference_date: "2026-09-17",
      issue_date: "2026-09-18",
      supplier: {
        identity_type: "6",
        identity_number: "20601234567",
        name: "FACTOSYS DEMO SAC",
      },
      lines: [
        {
          line_id: 1,
          document_type: "03",
          serie_number: "B001-00000001",
          status: "1",
          customer: { identity_type: "1", identity_number: "12345678" },
          totals: {
            gravadas: 100,
            exoneradas: 0,
            inafectas: 0,
            igv: 18,
            payable: 118,
          },
        },
      ],
    });
    expect(xml).toContain("SummaryDocuments");
    expect(xml).toContain("<cbc:CustomizationID>1.1</cbc:CustomizationID>");
    expect(xml).toContain("<cbc:ConditionCode>1</cbc:ConditionCode>");
    expect(fileStem).toBe("20601234567-RC-20260917-1");
  });
});

describe("GRE DespatchAdvice builder (S7-03/S7-04)", () => {
  const supplier09 = {
    identity_type: "6",
    identity_number: "20601234567",
    name: "FACTOSYS SPIKE SAC",
  };

  const gre09Canonical = {
    document_type: "09" as const,
    serie: "T001",
    number: 1,
    issue_date: "2026-09-17",
    issue_time: "10:00:00",
    supplier: supplier09,
    delivery_customer: {
      identity_type: "6",
      identity_number: "20123456789",
      name: "ACME SAC",
    },
    shipment: {
      transfer_reason_code: "01",
      transport_mode_code: "01",
      gross_weight: 10.5,
      gross_weight_unit: "KGM",
      start_date: "2026-09-17",
      carrier: {
        identity_type: "6",
        identity_number: "20600000000",
        name: "TRANSPORTE SAC",
      },
      origin: {
        ubigeo: "150101",
        address: "Av. Emisor 123, Lima",
      },
      destination: {
        ubigeo: "150122",
        address: "Av. Destino 456, Lima",
      },
    },
    related_documents: [
      { document_type: "01", serie_number: "F001-00000015" },
    ],
    lines: [
      {
        id: 1,
        quantity: 10,
        unit_code: "NIU",
        description: "Cajas de producto",
      },
    ],
  };

  const gre31Canonical = {
    document_type: "31" as const,
    serie: "V001",
    number: 1,
    issue_date: "2026-09-17",
    issue_time: "11:30:00",
    supplier: supplier09,
    shipper: {
      identity_type: "6",
      identity_number: "20111111111",
      name: "REMITENTE COMERCIAL SAC",
    },
    delivery_customer: {
      identity_type: "6",
      identity_number: "20123456789",
      name: "ACME SAC",
    },
    shipment: {
      gross_weight: 25,
      gross_weight_unit: "KGM",
      start_date: "2026-09-17",
      vehicles: [{ plate: "ABC-123" }],
      drivers: [
        {
          job_title: "Principal",
          identity_type: "1",
          identity_number: "12345678",
          name: "Juan Conductor Perez",
          license: "Q12345678",
        },
      ],
      origin: {
        ubigeo: "150101",
        address: "Almacén origen — Av. Industrial 100",
      },
      destination: {
        ubigeo: "040101",
        address: "Almacén destino Arequipa",
      },
    },
    related_documents: [
      { document_type: "09", serie_number: "T001-00000001" },
    ],
    lines: [
      {
        id: 1,
        quantity: 25,
        unit_code: "NIU",
        description: "Mercadería transportada",
      },
    ],
  };

  it("builds GRE 09 with HandlingCode, CarrierParty, DespatchLine (no tax)", () => {
    const { xml, fileStem } = new XmlDespatchAdviceBuilder().build(
      gre09Canonical,
    );
    expect(xml).toContain("DespatchAdvice");
    expect(xml).not.toContain("UBLExtensions");
    expect(xml).toContain("<cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>");
    expect(xml).toContain("<cbc:ID>T001-00000001</cbc:ID>");
    expect(xml).toContain("<cbc:HandlingCode>01</cbc:HandlingCode>");
    expect(xml).toContain("<cbc:TransportModeCode>01</cbc:TransportModeCode>");
    expect(xml).toContain('unitCode="KGM">10.5</cbc:GrossWeightMeasure>');
    expect(xml).toContain("<cbc:ID>SUNAT_Envio</cbc:ID>");
    expect(xml).toContain("CarrierParty");
    expect(xml).toContain("DespatchSupplierParty");
    expect(xml).toContain("DeliveryCustomerParty");
    expect(xml).toContain("AdditionalDocumentReference");
    expect(xml).toContain("DespatchLine");
    expect(xml).toContain("DeliveredQuantity");
    expect(xml).not.toContain("TaxTotal");
    expect(xml).not.toContain("DespatchParty");
    expect(fileStem).toBe("20601234567-09-T001-1");
  });

  it("matches golden GRE 09 unsigned structurally", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(gre09Canonical);
    const golden = readFileSync(
      join(process.cwd(), "testdata/golden/09-gre-remitente-min.unsigned.xml"),
      "utf8",
    );
    expect(normalizeXml(xml)).toBe(normalizeXml(golden));
  });

  it("builds GRE 31 with shipper DespatchParty, plate and driver license", () => {
    const { xml, fileStem } = new XmlDespatchAdviceBuilder().build(
      gre31Canonical,
    );
    expect(xml).toContain("<cbc:DespatchAdviceTypeCode>31</cbc:DespatchAdviceTypeCode>");
    expect(xml).toContain("<cbc:ID>V001-00000001</cbc:ID>");
    expect(xml).toContain("DespatchParty");
    expect(xml).toContain("20111111111");
    expect(xml).toContain("REMITENTE COMERCIAL SAC");
    expect(xml).toContain("<cbc:ID>ABC-123</cbc:ID>");
    expect(xml).toContain("TransportEquipment");
    expect(xml).toContain("DriverPerson");
    expect(xml).toContain("IdentityDocumentReference");
    expect(xml).toContain(">Q12345678</cbc:ID>");
    expect(xml).toContain("<cbc:JobTitle>Principal</cbc:JobTitle>");
    expect(xml).not.toContain("TaxTotal");
    expect(fileStem).toBe("20601234567-31-V001-1");
  });

  it("matches golden GRE 31 unsigned structurally", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(gre31Canonical);
    const golden = readFileSync(
      join(
        process.cwd(),
        "testdata/golden/31-gre-transportista-min.unsigned.xml",
      ),
      "utf8",
    );
    expect(normalizeXml(xml)).toBe(normalizeXml(golden));
  });
});

function normalizeXml(xml: string): string {
  return xml
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}
