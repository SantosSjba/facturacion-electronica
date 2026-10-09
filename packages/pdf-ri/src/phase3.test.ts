import { expect, it } from "vitest";
import { buildRiHtml, type PdfRenderInput } from "./index";
it.each(["09", "31"] as const)(
  "renders GRE %s quantities and QR without invoice amounts",
  (documentType) => {
    const input: PdfRenderInput = {
      documentType,
      issuer: { ruc: "20601234567", legalName: "GRE" },
      customer: { identityType: "6", identityNumber: "20123456789", name: "DESTINO" },
      serieNumber: "T001-1",
      issueDate: "2026-10-08",
      currency: "",
      totals: { total: "" },
      qrPayload: "https://e-factura.sunat.gob.pe/qr?fixture",
      digestValue: "",
      lines: [
        {
          description: "Bienes <frágiles>",
          quantity: "12",
          unit: "NIU",
          unitPrice: "",
          igv: "",
          amount: "",
        },
      ],
    };
    const html = buildRiHtml(input);
    expect(html).toContain("GUÍA DE REMISIÓN");
    expect(html).toContain("Destinatario");
    expect(html).toContain("12 NIU");
    expect(html).toContain("Bienes &lt;frágiles&gt;");
    expect(html).toContain(input.qrPayload);
    for (const label of [
      "Moneda:",
      "DigestValue",
      "Total:",
      '<th class="price">P.U.',
      "IGV / IVAP",
    ])
      expect(html).not.toContain(label);
  },
);
