/**
 * @factosys/sunat-ubl — UBL Invoice builder (Spike B / S1-UBL).
 * Unsigned XML only; signing is `@factosys/sunat-sign` (ADR-003).
 */

export const PACKAGE_NAME = "@factosys/sunat-ubl" as const;

export {
  BUILD_INVOICE_XML_PORT,
  type BuildInvoiceXmlPort,
  type BuildInvoiceXmlResult,
} from "./ports/build-invoice-xml.port";

export {
  assertInvoiceCanonical,
  invoiceCanonicalSchema,
  invoiceFixtureRequestSchema,
  parseFixtureRequest,
  type InvoiceCanonical,
  type InvoiceFixtureRequest,
  type InvoiceLineCanonical,
  type InvoiceTotals,
  type PartyCanonical,
} from "./types/invoice-canonical";

export {
  DEFAULT_CORRELATIVE,
  SPIKE_SUPPLIER,
  hydrateFromFixtureRequest,
  hydrateGravadaFixture,
  loadGravadaFixtureRequest,
} from "./hydrate/from-fixture";

export {
  computeAutoTotals,
  documentId,
  fileStem,
  formatMoney,
  padCorrelative,
  roundMoney,
  toCanonical,
} from "./totals/auto-totals";

export { loadTaxMatrix, resolveTaxPair } from "./totals/matrix-07-05";

export { ListUri, attrsForPath, loadListUriMappings } from "./attributes/listuri-injector";

export { XmlInvoiceBuilder } from "./adapters/invoice-xml.builder";

export { ublInternal, ublValidationError } from "./errors";
