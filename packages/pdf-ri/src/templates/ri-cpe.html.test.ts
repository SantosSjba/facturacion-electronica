import { describe, expect, it } from "vitest";
import { buildRiHtml } from "./ri-cpe.html";
import type { PdfRenderInput } from "../ports/pdf-renderer.port";

const input: PdfRenderInput = {
  documentType: "01",
  serieNumber: "F001-1",
  issueDate: "2026-10-08",
  currency: "PEN",
  issuer: { ruc: "20100070970", legalName: 'Empresa <"demo">' },
  customer: { identityType: "6", identityNumber: "20100070970", name: "Cliente" },
  lines: [],
  totals: { total: "100.00" },
  digestValue: "abc=",
  qrPayload: "abc",
};

describe("company logo in printed documents", () => {
  it.each(["01", "03", "07", "08"] as const)("embeds the PNG for document %s", (documentType) => {
    const html = buildRiHtml({
      ...input,
      documentType,
      issuer: { ...input.issuer, logoDataUrl: "data:image/png;base64,aGVsbG8=" },
    });
    expect(html).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(html).toContain('alt="Logo de Empresa &lt;&quot;demo&quot;&gt;"');
  });

  it.each([
    undefined,
    "https://example.com/logo.png",
    'data:image/png;base64,abc" onerror="alert(1)',
    "data:image/svg+xml;base64,abc",
  ])("ignores missing or unsafe image sources", (logoDataUrl) => {
    const html = buildRiHtml({ ...input, issuer: { ...input.issuer, logoDataUrl } });
    expect(html).not.toContain("<img");
    expect(html).toContain("Empresa &lt;&quot;demo&quot;&gt;");
  });
});
