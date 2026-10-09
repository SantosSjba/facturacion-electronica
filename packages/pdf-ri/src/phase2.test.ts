import {
  hydrateFromFixtureRequest,
  hydrateNoteFromFixtureRequest,
  XmlInvoiceBuilder,
  XmlCreditNoteBuilder,
  XmlDebitNoteBuilder,
  XmlSummaryDocumentsBuilder,
  XmlVoidedDocumentsBuilder,
} from "../../sunat-ubl/src/index";
import { phase1Request } from "../../sunat-ubl/test-fixtures/commercial-scenarios";
import { readSignedCpeQr, readSummaryXml } from "./qr/read-signed-xml";
import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildQrImage } from "./qr/qr-image";
import { buildQrPayload } from "./qr/build-qr-payload";
import { buildRiHtml } from "./templates/ri-cpe.html";
import type { PdfRenderInput } from "./ports/pdf-renderer.port";

const input: PdfRenderInput = {
  documentType: "01",
  serieNumber: "F001-1",
  issueDate: "2026-10-08",
  currency: "PEN",
  issuer: { ruc: "20601234567", legalName: "Emisor" },
  customer: { identityType: "6", identityNumber: "20100070970", name: "Cliente" },
  lines: [],
  totals: { total: "118.00" },
  digestValue: "abc=",
  qrPayload: "abc",
};
describe("phase 2 print contract", () => {
  it.each(["01", "03", "07", "08"])(
    "decodes PNG for CPE %s and respects physical dimensions",
    async (documentType) => {
      const payload = buildQrPayload({
        ruc: "20601234567",
        documentType,
        serie: "F001",
        number: "12",
        igv: "18.00",
        total: "118.00",
        issueDate: "2026-10-08",
        customerIdentityType: "6",
        customerIdentityNumber: "20100070970",
        digestValue: "012345678901234567890123456=",
      });
      const qr = await buildQrImage(payload);
      const png = PNG.sync.read(Buffer.from(qr.data_url.split(",")[1] ?? "", "base64"));
      expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(payload);
      expect(qr.error_correction).toBe("Q");
      expect(qr.module_mm).toBeGreaterThanOrEqual(0.19);
      expect(qr.quiet_zone_mm).toBeGreaterThanOrEqual(1);
      expect(qr.size_mm).toBeLessThanOrEqual(60);
    },
  );
  it.each(["A4", "A5", "TICKET80", "TICKET58"] as const)(
    "keeps every line and escapes observations for %s",
    (format) => {
      const html = buildRiHtml({
        ...input,
        format,
        observations: '<script>alert("x")</script>',
        lines: Array.from({ length: 100 }, (_, i) => ({
          description: `Artículo ${i + 1}`,
          quantity: "1",
          unit: "NIU",
          unitPrice: "118",
          igv: "18",
          amount: "118",
        })),
      });
      expect(html).toContain("Artículo 100");
      expect(html).toContain("thead { display: table-header-group;");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    },
  );
  it("preview has a watermark and no definitive QR or digest", () => {
    const html = buildRiHtml({ ...input, preview: true, qrDataUrl: "data:image/png;base64,AAAA" });
    expect(html).toContain("VISTA PREVIA");
    expect(html).toContain("SIN VALIDEZ TRIBUTARIA");
    expect(html).not.toContain('qr-image" alt');
    expect(html).not.toContain("DigestValue");
  });
  it("summary/baja is informational, without CPE customer, totals or QR", () => {
    const html = buildRiHtml({ ...input, documentType: "RA", informational: true });
    expect(html).toContain("DOCUMENTO INFORMATIVO");
    expect(html).not.toContain("Adquirente:");
    expect(html).not.toContain("<strong>Total:");
    expect(html).not.toContain("DigestValue");
  });
});

describe("definitive XML extraction", () => {
  it.each(["01", "03", "07", "08"] as const)(
    "takes %s number, taxes and parties from XML",
    (type) => {
      const r = phase1Request();
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
      const root =
        type === "01" || type === "03" ? "Invoice" : type === "07" ? "CreditNote" : "DebitNote";
      const qr = readSignedCpeQr(
        xml.replace(`</${root}>`, `<ds:DigestValue>abc=</ds:DigestValue></${root}>`),
      );
      expect(qr).toMatchObject({
        documentType: type,
        number: "00000001",
        igv: "18.00",
        total: "118.00",
        digestValue: "abc=",
        issueDate: r.issue_date,
        customerIdentityType: r.customer.identity_type,
        customerIdentityNumber: r.customer.identity_number,
      });
    },
  );
  it("recovers legacy RC and RA representations from their signed XML", () => {
    const supplier = { identity_type: "6", identity_number: "20601234567", name: "Emisor" };
    const rc = new XmlSummaryDocumentsBuilder().build({
      id: "RC-20261008-1",
      reference_date: "2026-10-08",
      issue_date: "2026-10-08",
      supplier,
      lines: [
        {
          line_id: 1,
          document_type: "03",
          serie_number: "B001-00000001",
          status: "1",
          customer: { identity_type: "1", identity_number: "12345678" },
          totals: { gravadas: 100, exoneradas: 0, inafectas: 0, igv: 18, payable: 118 },
        },
      ],
    });
    expect(readSummaryXml(rc.xml)).toMatchObject({
      id: "RC-20261008-1",
      supplier: { name: "Emisor" },
      lines: [
        {
          serie_number: "B001-00000001",
          status: "1",
          totals: { gravadas: 100, igv: 18, payable: 118 },
        },
      ],
    });
    const ra = new XmlVoidedDocumentsBuilder().build({
      id: "RA-20261008-1",
      reference_date: "2026-10-08",
      issue_date: "2026-10-08",
      supplier,
      lines: [
        { line_id: 1, document_type: "01", serie: "F001", number: 1, reason: "Error de emisión" },
      ],
    });
    expect(readSummaryXml(ra.xml)).toMatchObject({
      lines: [{ serie_number: "F001-1", reason: "Error de emisión" }],
    });
  });
});
