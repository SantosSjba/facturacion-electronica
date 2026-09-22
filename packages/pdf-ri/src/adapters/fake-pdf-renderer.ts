import type { PdfRenderInput, PdfRendererPort } from "../ports/pdf-renderer.port";
import { buildRiHtml } from "../templates/ri-cpe.html";

/**
 * Minimal valid PDF without a browser — suitable for CI (`PDF_RI_MODE=fake`).
 * Embeds DigestValue / QR payload as PDF text objects for smoke assertions.
 */
export class FakePdfRenderer implements PdfRendererPort {
  async render(input: PdfRenderInput): Promise<Uint8Array> {
    const html = buildRiHtml(input);
    const text = [
      "Factosys RI Fake PDF",
      input.documentType,
      input.serieNumber,
      `DigestValue:${input.digestValue}`,
      `QR:${input.qrPayload}`,
      html.slice(0, 200),
    ].join("\n");

    const escaped = text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\r?\n/g, "\\n");

    const stream = `BT /F1 10 Tf 50 750 Td (${escaped}) Tj ET`;
    const streamLen = Buffer.byteLength(stream, "utf8");

    const objects = [
      "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
      "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
      "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
      `4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream\nendobj\n`,
      "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += obj;
    }
    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefStart}\n%%EOF\n`;

    return new Uint8Array(Buffer.from(pdf, "utf8"));
  }
}
