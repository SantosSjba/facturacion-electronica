import type { PdfRenderInput, PdfRendererPort } from "../ports/pdf-renderer.port";
import { buildRiHtml } from "../templates/ri-cpe.html";

/**
 * Playwright Chromium HTML→PDF. Requires `playwright` installed and browsers.
 * Used when `PDF_RI_MODE=playwright`.
 */
export class PlaywrightPdfRenderer implements PdfRendererPort {
  async render(input: PdfRenderInput): Promise<Uint8Array> {
    // Dynamic import so CI/fake builds do not require playwright at load time.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(buildRiHtml(input), { waitUntil: "load" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      });
      return new Uint8Array(buf);
    } finally {
      await browser.close();
    }
  }
}
