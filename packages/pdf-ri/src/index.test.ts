import { describe, expect, it } from "vitest";

import {
  FakePdfRenderer,
  buildQrPayload,
  extractDigestValue,
} from "./index";

describe("@factosys/pdf-ri", () => {
  it("extracts DigestValue from signed XML", () => {
    const xml = `<SignedInfo/><DigestValue>abc+DEF/123=</DigestValue>`;
    expect(extractDigestValue(xml)).toBe("abc+DEF/123=");
  });

  it("builds QR payload pipes", () => {
    const qr = buildQrPayload({
      ruc: "20123456789",
      documentType: "01",
      serie: "F001",
      number: "1",
      igv: "18.00",
      total: "118.00",
      issueDate: "2026-09-17",
      customerIdentityType: "6",
      customerIdentityNumber: "20600000000",
      digestValue: "abc=",
    });
    expect(qr).toBe(
      "20123456789|01|F001|1|18.00|118.00|2026-09-17|6|20600000000|abc=",
    );
  });

  it("FakePdfRenderer returns %PDF magic", async () => {
    const renderer = new FakePdfRenderer();
    const bytes = await renderer.render({
      documentType: "01",
      serieNumber: "F001-00000001",
      issueDate: "2026-09-17",
      currency: "PEN",
      issuer: { ruc: "20123456789", legalName: "Demo SAC" },
      customer: {
        identityType: "6",
        identityNumber: "20600000000",
        name: "Cliente",
      },
      lines: [
        {
          description: "Item",
          quantity: "1",
          unit: "NIU",
          unitPrice: "100.00",
          igv: "18.00",
          amount: "118.00",
        },
      ],
      totals: { total: "118.00", igv: "18.00", gravado: "100.00" },
      digestValue: "digest==",
      qrPayload: "ruc|01|...",
    });
    const head = Buffer.from(bytes.slice(0, 5)).toString("utf8");
    expect(head).toBe("%PDF-");
  });
});
