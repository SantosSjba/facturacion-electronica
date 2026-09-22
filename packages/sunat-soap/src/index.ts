/**
 * @factosys/sunat-soap — SUNAT billService SendBill (Spike C / S2-SOAP).
 */

export const PACKAGE_NAME = "@factosys/sunat-soap" as const;

export {
  BILL_SERVICE_PORT,
  type BillServicePort,
} from "./ports/bill-service.port";
export type {
  SendBillInput,
  SendBillResult,
} from "./ports/bill-service.types";

export { packInvoiceZip } from "./zip/pack-invoice-zip";
export type {
  PackInvoiceZipInput,
  PackInvoiceZipResult,
} from "./zip/pack-invoice-zip";

export { FakeBillServiceAdapter } from "./adapters/fake-bill-service.adapter";
export type {
  FakeBillMode,
  FakeBillServiceOptions,
} from "./adapters/fake-bill-service.adapter";

export {
  SoapBillServiceAdapter,
  DEFAULT_BETA_WSDL,
  wsdlUrlToEndpoint,
} from "./adapters/soap-bill-service.adapter";
export type {
  SoapBillServiceOptions,
  FetchLike,
} from "./adapters/soap-bill-service.adapter";

export { createBillServiceFromEnv } from "./adapters/create-bill-service";

export {
  parseCdrZip,
  assertCdrAccepted,
} from "./cdr/parse-cdr-zip";
export type { CdrStatus, ParsedCdr } from "./cdr/parse-cdr-zip";

export {
  buildCdrZipFixture,
  buildApplicationResponseXml,
} from "./cdr/build-cdr-fixture";
export type { CdrFixtureKind } from "./cdr/build-cdr-fixture";

export {
  soapTransportError,
  soapTransportInternal,
  soapCdrRejected,
  soapCdrInternal,
} from "./errors";
