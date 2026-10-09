import {
  PDF_TEMPLATE_VERSION,
  type PdfRenderInput,
  type PdfRendererPort,
} from "../ports/pdf-renderer.port";
import { buildQrImage } from "../qr/qr-image";
import { buildRiHtml } from "../templates/ri-cpe.html";

/**
 * Playwright Chromium HTML→PDF. Requires `playwright` installed and browsers.
 * Used when `PDF_RI_MODE=playwright`.
 */
export class PlaywrightPdfRenderer implements PdfRendererPort {
  async render(input: PdfRenderInput): Promise<Uint8Array> {
    if (input.templateVersion && input.templateVersion !== PDF_TEMPLATE_VERSION)
      throw new Error(`Unsupported PDF template version: ${input.templateVersion}`);
    // Dynamic import so CI/fake builds do not require playwright at load time.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const qr =
        !input.preview && input.qrPayload ? await buildQrImage(input.qrPayload) : undefined;
      const format = input.format ?? "A4";
      const ticket = format === "TICKET80" || format === "TICKET58";
      await page.setContent(
        buildRiHtml({ ...input, qrDataUrl: qr?.data_url, qrSizeMm: qr?.size_mm }),
        { waitUntil: "load" },
      );
      const buf = await page.pdf({
        ...(ticket
          ? { width: format === "TICKET80" ? "80mm" : "58mm", height: "297mm" }
          : { format }),
        printBackground: true,
        margin: {
          top: ticket ? "4mm" : "10mm",
          bottom: ticket ? "4mm" : "10mm",
          left: ticket ? "3mm" : "10mm",
          right: ticket ? "3mm" : "10mm",
        },
        timeout: 30000,
      });
      return new Uint8Array(buf);
    } finally {
      await browser.close();
    }
  }
}
