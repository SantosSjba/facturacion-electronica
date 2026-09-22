/**
 * @factosys/sunat-soap — billService SOAP client (stub).
 * Spike C / S2 will implement SendBill.
 */

export const PACKAGE_NAME = "@factosys/sunat-soap" as const;

export interface BillServicePort {
  sendBill(_zipBase64: string): Promise<unknown>;
}
