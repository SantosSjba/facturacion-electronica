/**
 * @factosys/pdf-ri — printed representation PDF (stub).
 */

export const PACKAGE_NAME = "@factosys/pdf-ri" as const;

export interface PdfRendererPort {
  render(_document: unknown): Promise<Uint8Array>;
}
