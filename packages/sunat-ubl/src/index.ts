/**
 * @factosys/sunat-ubl — UBL builders (stub).
 * Spike B / S1 will implement Invoice builders; no SUNAT logic in S0.
 */

export const PACKAGE_NAME = "@factosys/sunat-ubl" as const;

/** Placeholder contract for future Invoice builder. */
export interface InvoiceBuilderPort {
  buildUnsignedInvoice(_input: unknown): Promise<string>;
}
