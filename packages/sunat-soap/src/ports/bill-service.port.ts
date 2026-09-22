import type { SendBillInput, SendBillResult } from "./bill-service.types";

/**
 * Nest / DI token for the active BillServicePort adapter.
 */
export const BILL_SERVICE_PORT: unique symbol = Symbol("BillServicePort");

/**
 * Port frozen by Spike C (doc 24 §C.1). Fake or SOAP adapter behind the same contract.
 */
export interface BillServicePort {
  sendBill(input: SendBillInput): Promise<SendBillResult>;
}
