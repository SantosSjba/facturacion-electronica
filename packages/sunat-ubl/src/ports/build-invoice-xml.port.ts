import type { InvoiceCanonical } from "../types/invoice-canonical";

export const BUILD_INVOICE_XML_PORT: unique symbol = Symbol("BuildInvoiceXmlPort");

export interface BuildInvoiceXmlResult {
  xml: string;
  /** `${ruc}-01-${serie}-${number}` without extension */
  fileStem: string;
}

/**
 * Port frozen by Spike B (doc 24 §B.2). Builds unsigned UBL only (ADR-003).
 */
export interface BuildInvoiceXmlPort {
  build(canonical: InvoiceCanonical): BuildInvoiceXmlResult;
}
