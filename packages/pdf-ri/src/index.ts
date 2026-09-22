import type { PdfRendererPort } from "./ports/pdf-renderer.port";
import { FakePdfRenderer } from "./adapters/fake-pdf-renderer";
import { PlaywrightPdfRenderer } from "./adapters/playwright-pdf-renderer";

export type { PdfDocumentType, PdfLineItem, PdfRenderInput, PdfRendererPort } from "./ports/pdf-renderer.port";
export { FakePdfRenderer } from "./adapters/fake-pdf-renderer";
export { PlaywrightPdfRenderer } from "./adapters/playwright-pdf-renderer";
export { buildRiHtml } from "./templates/ri-cpe.html";
export {
  buildQrPayload,
  extractDigestValue,
  type QrPayloadInput,
} from "./qr/build-qr-payload";

export const PACKAGE_NAME = "@factosys/pdf-ri" as const;

export type PdfRiMode = "fake" | "playwright";

export function createPdfRenderer(mode: PdfRiMode = "fake"): PdfRendererPort {
  if (mode === "playwright") {
    return new PlaywrightPdfRenderer();
  }
  return new FakePdfRenderer();
}
