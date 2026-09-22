import type {
  GetStatusInput,
  GetStatusResult,
  SendBillInput,
  SendBillResult,
  SendSummaryInput,
  SendSummaryResult,
} from "./bill-service.types";

/**
 * Nest / DI token for the active BillServicePort adapter.
 */
export const BILL_SERVICE_PORT: unique symbol = Symbol("BillServicePort");

/**
 * Port for billService: SendBill (sync CDR) + SendSummary/getStatus (async ticket).
 */
export interface BillServicePort {
  sendBill(input: SendBillInput): Promise<SendBillResult>;
  sendSummary(input: SendSummaryInput): Promise<SendSummaryResult>;
  getStatus(input: GetStatusInput): Promise<GetStatusResult>;
}
